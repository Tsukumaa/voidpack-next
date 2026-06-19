import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { directMessages, friendships } from '@/lib/db/schema'
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

  // Get profiles (raw to include last_seen_at added via ALTER TABLE)
  const profiles = await db.run(
    sql`SELECT user_id, username, avatar_url, last_seen_at FROM player_profiles WHERE user_id IN (${sql.join(friendIds.map(id => sql`${id}`), sql`, `)})`
  ).then(r => (r.rows as { user_id: string; username: string | null; avatar_url: string | null; last_seen_at: string | null }[]))

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

    const profile = profiles.find(p => p.user_id === fid)
    return {
      friendId:    fid,
      username:    profile?.username ?? null,
      avatarUrl:   profile?.avatar_url ?? null,
      lastMessage: lastMsg?.content ?? null,
      lastAt:      lastMsg?.createdAt ?? null,
      lastFromMe:  lastMsg?.senderId === uid,
      unread:      unreadRows.length,
      lastSeenAt:  profile?.last_seen_at ?? null,
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
