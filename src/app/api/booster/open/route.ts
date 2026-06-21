import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { customCards } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
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

  const { booster_type = 'void', count = 5 } = await req.json()

  const pool = booster_type === 'void'
    ? await db.select().from(customCards)
    : await db.select().from(customCards).where(eq(customCards.family, booster_type))

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

  return NextResponse.json({
    cards: picked.map(c => ({
      id: c.id, name: c.name, rarity: c.rarity, family: c.family,
      artUrl: c.imageUrl ?? null, description: c.description ?? null,
      artist: c.artist ?? null, artistUrl: c.artistUrl ?? null,
    }))
  })
}
