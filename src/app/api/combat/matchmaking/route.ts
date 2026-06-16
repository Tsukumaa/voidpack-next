import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { matchmakingQueue, gameSessions } from '@/lib/db/schema'
import { eq, ne, asc } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = session.user.id

  const { deck } = await req.json()

  // Check if there's already someone waiting
  const waiting = await db.query.matchmakingQueue.findFirst({
    where: (t, { ne }) => ne(t.userId, uid),
  })

  if (waiting) {
    // Match found
    await db.delete(matchmakingQueue).where(eq(matchmakingQueue.userId, waiting.userId))
    await db.delete(matchmakingQueue).where(eq(matchmakingQueue.userId, uid))

    const waitingDeck = typeof waiting.deck === 'string' ? JSON.parse(waiting.deck) : waiting.deck

    const initialState = {
      p1_hp: 30, p2_hp: 30,
      p1_mana: 1, p1_max_mana: 1,
      p2_mana: 0, p2_max_mana: 0,
      p1_board: [], p2_board: [],
      p1_deck: waitingDeck, p2_deck: deck,
      p1_hand: [], p2_hand: [],
      turn: 1, ranked: true,
    }

    const [gameSession] = await db.insert(gameSessions).values({
      player1Id:   waiting.userId,
      player2Id:   uid,
      status:      'active',
      currentTurn: waiting.userId,
      state:       JSON.stringify(initialState),
    }).returning()

    return NextResponse.json({ status: 'matched', session_id: gameSession.id, you_are: 'player2', session: gameSession })
  }

  // Join queue
  await db.insert(matchmakingQueue)
    .values({ userId: uid, deck: JSON.stringify(deck) })
    .onConflictDoUpdate({ target: matchmakingQueue.userId, set: { deck: JSON.stringify(deck), joinedAt: new Date().toISOString() } })

  return NextResponse.json({ status: 'waiting' })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await db.delete(matchmakingQueue).where(eq(matchmakingQueue.userId, session.user.id))
  return NextResponse.json({ ok: true })
}
