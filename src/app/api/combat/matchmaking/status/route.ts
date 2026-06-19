import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ status: 'unauthenticated' }, { status: 401 })
  const uid = session.user.id

  // Cherche une session active RÉCENTE (créée dans les 2 dernières minutes)
  // où le joueur participe et où l'adversaire est présent.
  // La fenêtre temporelle évite de matcher une vieille partie active non terminée.
  const gameSession = await db.query.gameSessions.findFirst({
    where: (t, { and, or, eq, isNotNull, gt }) => and(
      or(eq(t.player1Id, uid), eq(t.player2Id, uid)),
      eq(t.status, 'active'),
      isNotNull(t.player2Id),
      gt(t.createdAt, sql`datetime('now', '-120 seconds')`),
    ),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  })

  if (gameSession) {
    const you_are = gameSession.player1Id === uid ? 'player1' : 'player2'
    return NextResponse.json({ status: 'matched', you_are, session: gameSession })
  }

  return NextResponse.json({ status: 'waiting' })
}
