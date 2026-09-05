import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { combatStats, playerCards, playerProfiles, customCards } from '@/lib/db/schema'
import { eq, desc, sql, count } from 'drizzle-orm'
import { isSubscriberActive } from '@/lib/kofi/grant'

export async function GET(req: NextRequest) {
  const type  = req.nextUrl.searchParams.get('type') ?? 'combat'
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 50)

  if (type === 'combat') {
    const rows = await db
      .select({
        userId:        combatStats.userId,
        wins:          combatStats.wins,
        losses:        combatStats.losses,
        rankPoints:    combatStats.rankPoints,
        currentStreak: combatStats.currentStreak,
        bestStreak:    combatStats.bestStreak,
        username:     playerProfiles.username,
        avatarUrl:    playerProfiles.avatarUrl,
        role:         playerProfiles.role,
        isSubscriber: playerProfiles.isSubscriber,
        subscriberUntil: playerProfiles.subscriberUntil,
      })
      .from(combatStats)
      .leftJoin(playerProfiles, eq(combatStats.userId, playerProfiles.userId))
      .orderBy(desc(combatStats.rankPoints))
      .limit(limit)

    return NextResponse.json(rows.map(r => ({
      ...r,
      is_subscriber: isSubscriberActive(r),
    })), { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } })
  }

  const [totalCardsRow] = await db.select({ total: count() }).from(customCards)
  const totalAvailable = totalCardsRow?.total ?? 0

  // collection ladder: XP en premier, nombre de cartes en égalité
  const rows = await db
    .select({
      userId:           playerProfiles.userId,
      total:            sql<number>`COALESCE(SUM(${playerCards.count}), 0)`,
      unique:           sql<number>`COUNT(DISTINCT ${playerCards.cardId})`,
      xp:               playerProfiles.xp,
      level:            playerProfiles.level,
      username:         playerProfiles.username,
      avatarUrl:        playerProfiles.avatarUrl,
      highestRarity:    playerProfiles.highestRarity,
      role:             playerProfiles.role,
      isSubscriber:     playerProfiles.isSubscriber,
      subscriberUntil:  playerProfiles.subscriberUntil,
      packsOpened: playerProfiles.packsOpened,
    })
    .from(playerProfiles)
    .leftJoin(playerCards, eq(playerProfiles.userId, playerCards.userId))
    .groupBy(playerProfiles.userId)
    .orderBy(desc(playerProfiles.xp), desc(sql`COALESCE(SUM(${playerCards.count}), 0)`))
    .limit(limit)

  return NextResponse.json(rows.map(r => ({
    ...r,
    xp:               r.xp    ?? 0,
    level:            r.level ?? 1,
    collectionComplete: totalAvailable > 0 && (r.unique ?? 0) >= totalAvailable,
    is_subscriber: isSubscriberActive(r),
    packsOpened:   r.packsOpened ?? 0,
  })), { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } })
}
