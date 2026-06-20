import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { gameSessions, playerProfiles } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, id) })
  if (!session) return NextResponse.json(null, { status: 404 })

  // Joindre les pseudos des deux joueurs
  const ids = [session.player1Id, session.player2Id].filter(Boolean) as string[]
  const profiles = ids.length
    ? await db.select({ userId: playerProfiles.userId, username: playerProfiles.username, avatarUrl: playerProfiles.avatarUrl })
        .from(playerProfiles).where(inArray(playerProfiles.userId, ids))
    : []
  const profileOf = (uid: string | null) => uid ? profiles.find(p => p.userId === uid) : null

  return NextResponse.json({
    ...session,
    player1Username: profileOf(session.player1Id)?.username ?? null,
    player2Username: profileOf(session.player2Id)?.username ?? null,
    player1Avatar:   profileOf(session.player1Id)?.avatarUrl ?? null,
    player2Avatar:   profileOf(session.player2Id)?.avatarUrl ?? null,
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authSession = await auth()
  if (!authSession?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await db.delete(gameSessions).where(eq(gameSessions.id, id))
  return NextResponse.json({ ok: true })
}
