import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { gameSessions, gameActions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { actionType, payload, newState } = await req.json()

  const gameSession = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, id) })
  if (!gameSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  if (gameSession.currentTurn !== session.user.id) return NextResponse.json({ error: 'Not your turn' }, { status: 403 })

  // Insert action
  await db.insert(gameActions).values({
    sessionId:  id,
    playerId:   session.user.id,
    actionType,
    payload:    JSON.stringify(payload ?? {}),
  } as typeof gameActions.$inferInsert)

  // Update session state if end_turn
  if (actionType === 'end_turn' && newState) {
    const nextTurn = gameSession.currentTurn === gameSession.player1Id
      ? gameSession.player2Id
      : gameSession.player1Id

    await db.update(gameSessions)
      .set({
        state:       JSON.stringify(newState),
        currentTurn: nextTurn ?? undefined,
        turnNumber:  (gameSession.turnNumber ?? 1) + 1,
        updatedAt:   new Date().toISOString(),
      })
      .where(eq(gameSessions.id, id))
  } else if (actionType === 'surrender') {
    const winnerId = gameSession.currentTurn === gameSession.player1Id
      ? gameSession.player2Id
      : gameSession.player1Id

    await db.update(gameSessions)
      .set({ status: 'finished', winnerId: winnerId ?? undefined, finishedAt: new Date().toISOString() })
      .where(eq(gameSessions.id, id))
  }

  return NextResponse.json({ ok: true })
}
