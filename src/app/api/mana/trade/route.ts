import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerCards, playerProfiles } from '@/lib/db/schema'
import { eq, and, sql, gt } from 'drizzle-orm'

export const MANA_PER_RARITY: Record<string, number> = {
  common:    2,
  rare:      4,
  epic:      6,
  legendary: 30,
  void:      150,
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = session.user.id

  const { cardId, quantity } = await req.json() as { cardId: string; quantity: number }
  if (!cardId || !quantity || quantity < 1) return NextResponse.json({ error: 'invalid_params' }, { status: 400 })

  // Retire les copies et retourne la rareté en une seule requête
  // La condition count > quantity garantit qu'on garde au moins 1 exemplaire
  const [updated] = await db
    .update(playerCards)
    .set({ count: sql`${playerCards.count} - ${quantity}` })
    .where(and(
      eq(playerCards.userId, uid),
      eq(playerCards.cardId, cardId),
      gt(playerCards.count, quantity), // count - quantity >= 1
    ))
    .returning({ rarity: playerCards.rarity, newCount: playerCards.count })

  if (!updated) {
    return NextResponse.json({ error: 'not_enough_copies' }, { status: 400 })
  }

  const manaGain = (MANA_PER_RARITY[updated.rarity] ?? 5) * quantity

  const [updatedProfile] = await db
    .update(playerProfiles)
    .set({ mana: sql`${playerProfiles.mana} + ${manaGain}`, updatedAt: new Date().toISOString() })
    .where(eq(playerProfiles.userId, uid))
    .returning({ mana: playerProfiles.mana })

  return NextResponse.json({ ok: true, manaGain, manaTotal: updatedProfile?.mana ?? 0 })
}
