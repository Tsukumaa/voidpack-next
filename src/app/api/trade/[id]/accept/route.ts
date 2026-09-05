import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { tradeOffers, playerCards, playerDailyMissions } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { getTodayMissions } from '@/lib/game/achievements'

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

  // Vérifier que le sender a encore la carte offerte
  const senderHasOffered = await db.query.playerCards.findFirst({
    where: and(eq(playerCards.userId, trade.senderId), eq(playerCards.cardId, trade.offeredCardKey)),
  })
  if (!senderHasOffered || senderHasOffered.count < 1) {
    return NextResponse.json({ error: 'Le sender ne possède plus la carte offerte.' }, { status: 400 })
  }

  // Vérifier que le receiver a la carte demandée
  const receiverHasWanted = await db.query.playerCards.findFirst({
    where: and(eq(playerCards.userId, uid), eq(playerCards.cardId, trade.wantedCardKey)),
  })
  if (!receiverHasWanted || receiverHasWanted.count < 1) {
    return NextResponse.json({ error: 'Tu ne possèdes pas la carte demandée.' }, { status: 400 })
  }

  // Transfer offeredCard: sender -1, receiver +1
  if (senderHasOffered.count <= 1) {
    await db.delete(playerCards).where(and(eq(playerCards.userId, trade.senderId), eq(playerCards.cardId, trade.offeredCardKey)))
  } else {
    await db.update(playerCards).set({ count: sql`${playerCards.count} - 1` })
      .where(and(eq(playerCards.userId, trade.senderId), eq(playerCards.cardId, trade.offeredCardKey)))
  }
  await db.insert(playerCards)
    .values({ userId: uid, cardId: trade.offeredCardKey, rarity: trade.offeredRarity, family: senderHasOffered.family, count: 1, metadata: senderHasOffered.metadata })
    .onConflictDoUpdate({ target: [playerCards.userId, playerCards.cardId], set: { count: sql`${playerCards.count} + 1`, lastObtainedAt: sql`datetime('now')` } })

  // Transfer wantedCard: receiver -1, sender +1
  if (receiverHasWanted.count <= 1) {
    await db.delete(playerCards).where(and(eq(playerCards.userId, uid), eq(playerCards.cardId, trade.wantedCardKey)))
  } else {
    await db.update(playerCards).set({ count: sql`${playerCards.count} - 1` })
      .where(and(eq(playerCards.userId, uid), eq(playerCards.cardId, trade.wantedCardKey)))
  }
  await db.insert(playerCards)
    .values({ userId: trade.senderId, cardId: trade.wantedCardKey, rarity: trade.wantedRarity ?? 'common', family: receiverHasWanted.family, count: 1, metadata: receiverHasWanted.metadata })
    .onConflictDoUpdate({ target: [playerCards.userId, playerCards.cardId], set: { count: sql`${playerCards.count} + 1`, lastObtainedAt: sql`datetime('now')` } })

  await db.update(tradeOffers)
    .set({ status: 'accepted', respondedAt: new Date().toISOString() })
    .where(eq(tradeOffers.id, id))

  // Incrémenter la mission "make_trade" pour les deux parties directement en DB
  const todayMissions = getTodayMissions()
  const tradeMission  = todayMissions.find(m => m.id === 'make_trade')
  if (tradeMission) {
    const date = new Date().toISOString().split('T')[0]
    for (const targetUid of [uid, trade.senderId]) {
      db.insert(playerDailyMissions)
        .values({ userId: targetUid, date, missionId: 'make_trade', progress: 1 })
        .onConflictDoUpdate({
          target: [playerDailyMissions.userId, playerDailyMissions.date, playerDailyMissions.missionId],
          set: { progress: sql`MIN(${playerDailyMissions.progress} + 1, ${tradeMission.goal})`, updatedAt: new Date().toISOString() },
        })
        .catch(() => {})
    }
  }

  return NextResponse.json({ ok: true })
}
