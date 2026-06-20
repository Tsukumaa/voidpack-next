import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerCards, playerProfiles } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'

export const MANA_PER_RARITY: Record<string, number> = {
  common:    5,
  rare:      20,
  epic:      80,
  legendary: 200,
  void:      500,
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = session.user.id

  const { cardId, quantity } = await req.json() as { cardId: string; quantity: number }
  if (!cardId || !quantity || quantity < 1) return NextResponse.json({ error: 'invalid_params' }, { status: 400 })

  // Vérifier que le joueur possède la carte avec assez de copies
  const [row] = await db.select()
    .from(playerCards)
    .where(and(eq(playerCards.userId, uid), eq(playerCards.cardId, cardId)))
    .limit(1)

  if (!row) return NextResponse.json({ error: 'card_not_owned' }, { status: 404 })
  if (row.count - quantity < 1) return NextResponse.json({ error: 'not_enough_copies', max: row.count - 1 }, { status: 400 })

  const manaGain = (MANA_PER_RARITY[row.rarity] ?? 5) * quantity

  // Retirer les copies et ajouter le mana en une transaction
  await db.batch([
    db.update(playerCards)
      .set({ count: sql`${playerCards.count} - ${quantity}` })
      .where(and(eq(playerCards.userId, uid), eq(playerCards.cardId, cardId))),
    db.update(playerProfiles)
      .set({ mana: sql`${playerProfiles.mana} + ${manaGain}`, updatedAt: new Date().toISOString() })
      .where(eq(playerProfiles.userId, uid)),
  ])

  // Récupérer le nouveau total
  const profile = await db.query.playerProfiles.findFirst({ where: eq(playerProfiles.userId, uid) })

  return NextResponse.json({ ok: true, manaGain, manaTotal: profile?.mana ?? 0 })
}
