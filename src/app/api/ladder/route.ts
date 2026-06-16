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

  // collection ladder: XP en premier, nombre de cartes en égalité
  const rows = await db
    .select({
      userId:        playerCards.userId,
      total:         count(),
      xp:            playerProfiles.xp,
      level:         playerProfiles.level,
      username:      playerProfiles.username,
      avatarUrl:     playerProfiles.avatarUrl,
      highestRarity: playerProfiles.highestRarity,
    })
    .from(playerCards)
    .leftJoin(playerProfiles, eq(playerCards.userId, playerProfiles.userId))
    .groupBy(playerCards.userId)
    .orderBy(desc(playerProfiles.xp), desc(count()))
    .limit(limit)

  return NextResponse.json(rows.map(r => ({
    ...r,
    xp:    r.xp    ?? 0,
    level: r.level ?? 1,
  })))
}
