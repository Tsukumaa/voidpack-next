import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { gameChallenges, gameSessions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { deck } = await req.json()
  const uid = session.user.id

  const challenge = await db.query.gameChallenges.findFirst({
    where: and(eq(gameChallenges.id, id), eq(gameChallenges.challengedId, uid)),
  })

  if (!challenge) return NextResponse.json({ error: 'Challenge introuvable.' }, { status: 404 })
  if (challenge.status !== 'pending') return NextResponse.json({ error: 'Challenge déjà traité.' }, { status: 400 })

  const now = new Date().toISOString()

  const [gameSession] = await db.insert(gameSessions)
    .values({
      player1Id:   challenge.challengerId,
      player2Id:   uid,
      status:      'active',
      currentTurn: challenge.challengerId,
      state:       JSON.stringify({ p1Deck: JSON.parse(challenge.deck), p2Deck: deck ?? [] }),
      updatedAt:   now,
    })
    .returning()

  await db.update(gameChallenges)
    .set({ status: 'accepted', sessionId: gameSession.id, updatedAt: now })
    .where(eq(gameChallenges.id, id))

  return NextResponse.json({ sessionId: gameSession.id })
}
