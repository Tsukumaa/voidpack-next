import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { gameSessions } from '@/lib/db/schema'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { deck, ranked = true } = await req.json()

  const initialState = {
    p1_hp: 30, p2_hp: 30,
    p1_mana: 1, p1_max_mana: 1,
    p2_mana: 0, p2_max_mana: 0,
    p1_board: [], p2_board: [],
    p1_deck: deck, p2_deck: [],
    p1_hand: [], p2_hand: [],
    turn: 1, ranked,
  }

  const [gameSession] = await db
    .insert(gameSessions)
    .values({
      player1Id:   session.user.id,
      status:      'waiting',
      currentTurn: session.user.id,
      state:       JSON.stringify(initialState),
    })
    .returning()

  return NextResponse.json(gameSession)
}
