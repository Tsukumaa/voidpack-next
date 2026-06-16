import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { boosterCodeRedemptions, playerCards } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { redemptionId, cards } = await req.json()
  if (!redemptionId) return NextResponse.json({ error: 'Redemption ID manquant.' }, { status: 400 })

  const uid = session.user.id

  const redemption = await db.query.boosterCodeRedemptions.findFirst({
    where: and(
      eq(boosterCodeRedemptions.id, redemptionId),
      eq(boosterCodeRedemptions.userId, uid),
    ),
  })

  if (!redemption) return NextResponse.json({ error: 'Rédemption introuvable.' }, { status: 404 })
  if (redemption.status === 'completed') return NextResponse.json({ ok: true, alreadyCompleted: true })

  const now = new Date().toISOString()

  await db.update(boosterCodeRedemptions)
    .set({ status: 'completed', completedAt: now, cards: JSON.stringify(cards ?? []) })
    .where(eq(boosterCodeRedemptions.id, redemptionId))

  if (Array.isArray(cards) && cards.length > 0) {
    await db.insert(playerCards).values(
      cards.map((c: { card_id?: string; id?: string; rarity?: string; family?: string }) => ({
        userId: uid,
        cardId: c.card_id ?? c.id ?? '',
        rarity: c.rarity ?? 'common',
        family: c.family ?? 'global',
      }))
    )
  }

  return NextResponse.json({ ok: true })
}
