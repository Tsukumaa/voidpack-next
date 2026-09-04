import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { customCards, families, boosterCredits } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { checkFeature } from '@/lib/features'

const RARITY_WEIGHTS: Record<string, number> = {
  common:    60,
  rare:      24,
  epic:      13,
  legendary:  2.5,
  void:       0.5,
}

function weightedRoll(pool: { rarity: string }[]): number {
  const weights = pool.map(c => RARITY_WEIGHTS[c.rarity] ?? 10)
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r <= 0) return i
  }
  return pool.length - 1
}

export async function POST(req: NextRequest) {
  const blocked = await checkFeature('feature_pack_opening')
  if (blocked) return blocked
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = session.user.id
  const { booster_type = 'void', count = 5, creditId } = await req.json()

  // Si un creditId est fourni, vérifier le crédit et retourner les cartes déjà rollées si disponibles
  if (creditId != null) {
    const credit = await db.query.boosterCredits.findFirst({
      where: and(eq(boosterCredits.id, Number(creditId)), eq(boosterCredits.userId, uid)),
    })

    if (!credit) return NextResponse.json({ error: 'Crédit introuvable.' }, { status: 404 })

    // Déjà ouvert → retourner les mêmes cartes (idempotent)
    if (credit.openedCards) {
      return NextResponse.json({ cards: JSON.parse(credit.openedCards) })
    }

    if (credit.claimed) {
      return NextResponse.json({ error: 'Ce booster a déjà été réclamé.' }, { status: 400 })
    }
  }

  // Construire le pool
  const activeFamilies = (await db.select({ key: families.key }).from(families).where(eq(families.active, true))).map(f => f.key)

  const pool = booster_type === 'void'
    ? await db.select().from(customCards).then(cards => cards.filter(c => activeFamilies.includes(c.family) || c.family === 'global'))
    : activeFamilies.includes(booster_type)
      ? await db.select().from(customCards).where(eq(customCards.family, booster_type))
      : []

  if (!pool.length) {
    const rarities = ['common', 'rare', 'epic', 'legendary']
    return NextResponse.json({
      cards: Array.from({ length: count }, (_, i) => ({
        id: `placeholder-${i}`,
        name: `Carte mystère ${i + 1}`,
        rarity: rarities[Math.floor(Math.random() * rarities.length)],
        family: booster_type,
        artUrl: null,
      }))
    })
  }

  const picked: typeof pool = []
  for (let i = 0; i < count; i++) {
    picked.push(pool[weightedRoll(pool)])
  }

  const hasGood = picked.some(c => c.rarity !== 'common')
  if (!hasGood) {
    const goodPool = pool.filter(c => c.rarity !== 'common')
    if (goodPool.length) picked[picked.length - 1] = goodPool[Math.floor(Math.random() * goodPool.length)]
  }

  const cards = picked.map(c => ({
    id: c.id, name: c.name, rarity: c.rarity, family: c.family,
    artUrl: c.imageUrl ?? null, description: c.description ?? null,
    artist: c.artist ?? null, artistUrl: c.artistUrl ?? null,
  }))

  // Verrouiller les cartes dans le crédit pour éviter le re-roll au refresh
  if (creditId != null) {
    await db.update(boosterCredits)
      .set({ openedCards: JSON.stringify(cards) })
      .where(and(eq(boosterCredits.id, Number(creditId)), eq(boosterCredits.userId, uid)))
  }

  return NextResponse.json({ cards })
}
