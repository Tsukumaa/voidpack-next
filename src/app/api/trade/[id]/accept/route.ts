import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { tradeOffers, playerCards } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const uid = session.user.id

  const trade = await db.query.tradeOffers.findFirst({
    where: and(eq(tradeOffers.id, id), eq(tradeOffers.receiverId, uid)),
  })

  if (!trade) return NextResponse.json({ error: 'Trade introuvable.' }, { status: 404 })
  if (trade.status !== 'pending') return NextResponse.json({ error: 'Trade déjà traité.' }, { status: 400 })

  const now = new Date().toISOString()

  // Transfer offered card to receiver
  await db.update(playerCards)
    .set({ userId: uid })
    .where(eq(playerCards.id, trade.offeredCardId))

  await db.update(tradeOffers)
    .set({ status: 'accepted', respondedAt: now })
    .where(eq(tradeOffers.id, id))

  return NextResponse.json({ ok: true })
}
