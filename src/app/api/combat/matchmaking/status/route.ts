import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { gameSessions } from '@/lib/db/schema'
import { or, eq, and } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ status: 'unauthenticated' }, { status: 401 })
  const uid = session.user.id

  // Look for a recently created active session where the user is player2
  const gameSession = await db.query.gameSessions.findFirst({
    where: (t, { and, eq }) => and(eq(t.player2Id, uid), eq(t.status, 'active')),
  })

  if (gameSession) {
    return NextResponse.json({ status: 'matched', you_are: 'player2', session: gameSession })
  }

  return NextResponse.json({ status: 'waiting' })
}
