import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { combatStats, playerCards, playerProfiles } from '@/lib/db/schema'
import { eq, desc, count } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const type  = req.nextUrl.searchParams.get('type') ?? 'combat'
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 50)

  if (type === 'combat') {
    const rows = await db
      .select({
        userId:     combatStats.userId,
        wins:       combatStats.wins,
        losses:     combatStats.losses,
        rankPoints: combatStats.rankPoints,
        username:   playerProfiles.username,
        avatarUrl:  playerProfiles.avatarUrl,
      })
      .from(combatStats)
      .leftJoin(playerProfiles, eq(combatStats.userId, playerProfiles.userId))
      .orderBy(desc(combatStats.rankPoints))
      .limit(limit)

    return NextResponse.json(rows)
  }

  // collection ladder: rank by card count
  const rows = await db
    .select({ userId: playerCards.userId, total: count() })
    .from(playerCards)
    .groupBy(playerCards.userId)
    .orderBy(desc(count()))
    .limit(limit)

  const userIds = rows.map(r => r.userId)
  const profiles = userIds.length
    ? await db.query.playerProfiles.findMany({
        where: (t, { inArray }) => inArray(t.userId, userIds),
      })
    : []

  return NextResponse.json(rows.map(r => {
    const p = profiles.find(p => p.userId === r.userId)
    return {
      ...r,
      username:  p?.username,
      avatarUrl: p?.avatarUrl,
      xp:        p?.xp ?? 0,
      level:     p?.level ?? 1,
      highestRarity: p?.highestRarity ?? null,
    }
  }))
}
