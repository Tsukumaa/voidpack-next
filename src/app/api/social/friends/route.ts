import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { friendships, playerProfiles } from '@/lib/db/schema'
import { eq, or, and } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json([], { status: 401 })
  const uid = session.user.id

  const rows = await db
    .select()
    .from(friendships)
    .where(and(
      or(eq(friendships.senderId, uid), eq(friendships.receiverId, uid)),
      eq(friendships.status, 'accepted')
    ))

  const friendIds = rows.map(r => r.senderId === uid ? r.receiverId : r.senderId)
  if (!friendIds.length) return NextResponse.json([])

  const profiles = await db.query.playerProfiles.findMany({
    where: (t, { inArray }) => inArray(t.userId, friendIds),
  })

  const result = rows.map(r => {
    const friendId = r.senderId === uid ? r.receiverId : r.senderId
    const profile  = profiles.find(p => p.userId === friendId)
    return { friendshipId: r.id, userId: friendId, username: profile?.username, avatarUrl: profile?.avatarUrl, status: r.status }
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { receiverId } = await req.json()
  const uid = session.user.id

  if (!receiverId || receiverId === uid) {
    return NextResponse.json({ error: 'invalid_receiver' }, { status: 400 })
  }

  // Vérifie si une relation existe déjà dans les deux sens
  const existing = await db
    .select()
    .from(friendships)
    .where(or(
      and(eq(friendships.senderId, uid), eq(friendships.receiverId, receiverId)),
      and(eq(friendships.senderId, receiverId), eq(friendships.receiverId, uid)),
    ))
    .limit(1)

  if (existing.length > 0) {
    return NextResponse.json({ error: 'already_exists' }, { status: 409 })
  }

  try {
    await db.insert(friendships).values({ senderId: uid, receiverId })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'already_exists' }, { status: 409 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { friendshipId, accept } = await req.json()
  await db
    .update(friendships)
    .set({ status: accept ? 'accepted' : 'blocked', updatedAt: new Date().toISOString() })
    .where(eq(friendships.id, friendshipId))

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { friendshipId } = await req.json()
  await db.delete(friendships).where(eq(friendships.id, friendshipId))
  return NextResponse.json({ ok: true })
}
