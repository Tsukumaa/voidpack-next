import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { gameSessions, playerProfiles } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, id) })
  if (!session) return NextResponse.json(null, { status: 404 })

  // Auto-expire : session active sans activité depuis 8 minutes → finished
  if (session.status === 'active' && session.updatedAt) {
    const updatedAt = new Date(session.updatedAt).getTime()
    if (Date.now() - updatedAt > 8 * 60 * 1000) {
      const now = new Date().toISOString()
      await db.update(gameSessions)
        .set({ status: 'finished', finishedAt: now, updatedAt: now })
        .where(eq(gameSessions.id, id))
      session.status = 'finished'
    }
  }

  // ?poll=1 : retourne uniquement les champs nécessaires au polling (sans jointure profils)
  const isPoll = req.nextUrl.searchParams.get('poll') === '1'
  if (isPoll) {
    return NextResponse.json({
      id: session.id,
      status: session.status,
      currentTurn: session.currentTurn,
      state: session.state,
      updatedAt: session.updatedAt,
      winnerId: session.winnerId,
    })
  }

  // Chargement initial : joindre les pseudos/avatars des deux joueurs
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

// Marque la session comme abandonnée si elle est encore active (appelé au unmount du combat)
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const now = new Date().toISOString()
  await db.update(gameSessions)
    .set({ status: 'finished', finishedAt: now, updatedAt: now })
    .where(eq(gameSessions.id, id))
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authSession = await auth()
  if (!authSession?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await db.delete(gameSessions).where(eq(gameSessions.id, id))
  return NextResponse.json({ ok: true })
}
