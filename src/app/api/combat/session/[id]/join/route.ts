import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { gameSessions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { deck } = await req.json()

  const existing = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, id) })
  if (!existing || existing.status !== 'waiting') {
    return NextResponse.json({ error: 'Session not available' }, { status: 400 })
  }

  const currentState = typeof existing.state === 'string' ? JSON.parse(existing.state) : existing.state
  const newState = { ...currentState, p2_deck: deck, p2_hand: [], p2_board: [] }

  await db
    .update(gameSessions)
    .set({
      player2Id:   session.user.id,
      status:      'active',
      currentTurn: existing.player1Id,
      state:       JSON.stringify(newState),
      updatedAt:   new Date().toISOString(),
    })
    .where(eq(gameSessions.id, id))

  return NextResponse.json({ ok: true })
}
