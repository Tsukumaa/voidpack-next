import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerCards, playerProfiles } from '@/lib/db/schema'
import { eq, and, gt, sql } from 'drizzle-orm'
import { MANA_PER_RARITY } from '../route'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = session.user.id

  const { items } = await req.json() as { items: { cardId: string; quantity: number }[] }
  if (!Array.isArray(items) || items.length === 0)
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 })

  let totalMana = 0
  const errors: string[] = []

  for (const { cardId, quantity } of items) {
    if (!cardId || !quantity || quantity < 1) continue
    const [updated] = await db
      .update(playerCards)
      .set({ count: sql`${playerCards.count} - ${quantity}` })
      .where(and(
        eq(playerCards.userId, uid),
        eq(playerCards.cardId, cardId),
        gt(playerCards.count, quantity),
      ))
      .returning({ rarity: playerCards.rarity })

    if (!updated) { errors.push(cardId); continue }
    totalMana += (MANA_PER_RARITY[updated.rarity] ?? 5) * quantity
  }

  if (totalMana === 0) return NextResponse.json({ error: 'Aucune carte recyclable', errors }, { status: 400 })

  const [updatedProfile] = await db
    .update(playerProfiles)
    .set({ mana: sql`${playerProfiles.mana} + ${totalMana}`, updatedAt: new Date().toISOString() })
    .where(eq(playerProfiles.userId, uid))
    .returning({ mana: playerProfiles.mana })

  return NextResponse.json({ ok: true, manaGain: totalMana, manaTotal: updatedProfile?.mana ?? 0, errors })
}
