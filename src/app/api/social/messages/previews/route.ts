import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { directMessages, friendships, playerProfiles } from '@/lib/db/schema'
import { eq, or, and, isNull } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json([])
  const uid = session.user.id

  // Get accepted friends
  const friendRows = await db
    .select()
    .from(friendships)
    .where(and(
      or(eq(friendships.senderId, uid), eq(friendships.receiverId, uid)),
      eq(friendships.status, 'accepted')
    ))

  const friendIds = friendRows.map(r => r.senderId === uid ? r.receiverId : r.senderId)
  if (!friendIds.length) return NextResponse.json([])

  // Get profiles
  const profiles = await db.query.playerProfiles.findMany({
    where: (t, { inArray }) => inArray(t.userId, friendIds),
  })

  // Get last message per friend + unread count
  const previews = await Promise.all(friendIds.map(async (fid) => {
    const [lastMsg] = await db
      .select()
      .from(directMessages)
      .where(or(
        and(eq(directMessages.senderId, uid), eq(directMessages.receiverId, fid)),
        and(eq(directMessages.senderId, fid), eq(directMessages.receiverId, uid)),
      ))
      .orderBy(sql`${directMessages.createdAt} DESC`)
      .limit(1)

    const unreadRows = await db
      .select({ id: directMessages.id })
      .from(directMessages)
      .where(and(
        eq(directMessages.senderId, fid),
        eq(directMessages.receiverId, uid),
        isNull(directMessages.readAt),
      ))

    const profile = profiles.find(p => p.userId === fid)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastSeenAt = (profile as any)?.lastSeenAt ?? (profile as any)?.last_seen_at ?? null
    return {
      friendId:    fid,
      username:    profile?.username ?? null,
      avatarUrl:   profile?.avatarUrl ?? null,
      lastMessage: lastMsg?.content ?? null,
      lastAt:      lastMsg?.createdAt ?? null,
      lastFromMe:  lastMsg?.senderId === uid,
      unread:      unreadRows.length,
      lastSeenAt,
    }
  }))

  // Sort: friends with messages first (by time desc), then the rest
  previews.sort((a, b) => {
    if (a.lastAt && b.lastAt) return b.lastAt.localeCompare(a.lastAt)
    if (a.lastAt) return -1
    if (b.lastAt) return 1
    return 0
  })

  return NextResponse.json(previews)
}
