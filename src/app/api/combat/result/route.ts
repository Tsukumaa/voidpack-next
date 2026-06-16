import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { gameSessions, combatStats } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

const WIN_POINTS  = 25
const LOSS_POINTS = -15

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, winnerId } = await req.json()
  if (!sessionId || !winnerId) return NextResponse.json({ error: 'sessionId et winnerId requis.' }, { status: 400 })

  const gameSession = await db.query.gameSessions.findFirst({
    where: eq(gameSessions.id, sessionId),
  })

  if (!gameSession) return NextResponse.json({ error: 'Session introuvable.' }, { status: 404 })
  if (gameSession.status === 'finished') return NextResponse.json({ ok: true, alreadyFinished: true })

  const now = new Date().toISOString()

  await db.update(gameSessions)
    .set({ status: 'finished', winnerId, finishedAt: now, updatedAt: now })
    .where(eq(gameSessions.id, sessionId))

  const loserId = gameSession.player1Id === winnerId ? gameSession.player2Id : gameSession.player1Id
  if (!loserId) return NextResponse.json({ ok: true })

  // Upsert winner stats
  await db.insert(combatStats)
    .values({ userId: winnerId, wins: 1, rankPoints: WIN_POINTS, peakPoints: WIN_POINTS, currentStreak: 1, bestStreak: 1, seasonWins: 1, updatedAt: now })
    .onConflictDoUpdate({
      target: combatStats.userId,
      set: {
        wins:          sql`${combatStats.wins} + 1`,
        rankPoints:    sql`MAX(0, ${combatStats.rankPoints} + ${WIN_POINTS})`,
        peakPoints:    sql`MAX(${combatStats.peakPoints}, ${combatStats.rankPoints} + ${WIN_POINTS})`,
        currentStreak: sql`${combatStats.currentStreak} + 1`,
        bestStreak:    sql`MAX(${combatStats.bestStreak}, ${combatStats.currentStreak} + 1)`,
        seasonWins:    sql`${combatStats.seasonWins} + 1`,
        updatedAt:     now,
      },
    })

  // Upsert loser stats
  await db.insert(combatStats)
    .values({ userId: loserId, losses: 1, rankPoints: Math.max(0, LOSS_POINTS), currentStreak: 0, seasonLosses: 1, updatedAt: now })
    .onConflictDoUpdate({
      target: combatStats.userId,
      set: {
        losses:        sql`${combatStats.losses} + 1`,
        rankPoints:    sql`MAX(0, ${combatStats.rankPoints} + ${LOSS_POINTS})`,
        currentStreak: 0,
        seasonLosses:  sql`${combatStats.seasonLosses} + 1`,
        updatedAt:     now,
      },
    })

  return NextResponse.json({ ok: true })
}
