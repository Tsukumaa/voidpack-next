import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ status: 'unauthenticated' }, { status: 401 })
  const uid = session.user.id

  // Cherche une session active récente où le joueur participe (player1 OU player2)
  // et où l'adversaire est bien présent (player2_id renseigné).
  const gameSession = await db.query.gameSessions.findFirst({
    where: (t, { and, or, eq, isNotNull }) => and(
      or(eq(t.player1Id, uid), eq(t.player2Id, uid)),
      eq(t.status, 'active'),
      isNotNull(t.player2Id),
    ),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  })

  if (gameSession) {
    const you_are = gameSession.player1Id === uid ? 'player1' : 'player2'
    return NextResponse.json({ status: 'matched', you_are, session: gameSession })
  }

  return NextResponse.json({ status: 'waiting' })
}
