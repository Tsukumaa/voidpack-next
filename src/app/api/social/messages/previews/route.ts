import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, dbClient } from '@/lib/db'
import { directMessages, friendships } from '@/lib/db/schema'
import { eq, or, and, count } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { playerCards, customCards } from '@/lib/db/schema'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json([])
  const uid = session.user.id

  const friendRows = await db
    .select({ senderId: friendships.senderId, receiverId: friendships.receiverId })
    .from(friendships)
    .where(and(
      or(eq(friendships.senderId, uid), eq(friendships.receiverId, uid)),
      eq(friendships.status, 'accepted')
    ))

  const friendIds = friendRows.map(r => r.senderId === uid ? r.receiverId : r.senderId)
  if (!friendIds.length) return NextResponse.json([])

  const ph = friendIds.map(() => '?').join(', ')

  // Tout en parallèle : profils, total cartes, cartes uniques par ami,
  // dernier message par ami (agrégé), non-lus par ami (agrégé)
  const [profileResult, [totalRow], uniqueRows, lastMsgs, unreadCounts] = await Promise.all([
    dbClient.execute({
      sql: `SELECT user_id, username, avatar_url, last_seen_at, role, is_subscriber, subscriber_until FROM player_profiles WHERE user_id IN (${ph})`,
      args: friendIds,
    }),
    db.select({ total: count() }).from(customCards),
    db.select({ userId: playerCards.userId, unique: sql<number>`COUNT(DISTINCT ${playerCards.cardId})` })
      .from(playerCards)
      .where(sql`${playerCards.userId} IN (${sql.join(friendIds.map(id => sql`${id}`), sql`, `)})`)
      .groupBy(playerCards.userId),
    // Dernier message par pair en une seule requête (window function)
    dbClient.execute({
      sql: `
        SELECT sender_id, receiver_id, content, created_at, read_at,
          ROW_NUMBER() OVER (PARTITION BY
            CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END
            ORDER BY created_at DESC
          ) AS rn
        FROM direct_messages
        WHERE sender_id = ? OR receiver_id = ?
      `,
      args: [uid, uid, uid],
    }),
    // Nombre de non-lus par expéditeur ami en une requête
    dbClient.execute({
      sql: `SELECT sender_id, COUNT(*) as cnt FROM direct_messages WHERE receiver_id = ? AND read_at IS NULL AND sender_id IN (${ph}) GROUP BY sender_id`,
      args: [uid, ...friendIds],
    }),
  ])

  type ProfileRow = { user_id: string; username: string | null; avatar_url: string | null; last_seen_at: string | null; role: string | null; is_subscriber: number | null; subscriber_until: string | null }
  type MsgRow = { sender_id: string; receiver_id: string; content: string; created_at: string; read_at: string | null; rn: number }
  type UnreadRow = { sender_id: string; cnt: number }

  const profiles = profileResult.rows as unknown as ProfileRow[]
  const allMsgs  = (lastMsgs.rows as unknown as MsgRow[]).filter(r => Number(r.rn) === 1)
  const unreadMap = Object.fromEntries((unreadCounts.rows as unknown as UnreadRow[]).map(r => [r.sender_id, Number(r.cnt)]))
  const uniqueMap = Object.fromEntries(uniqueRows.map(r => [r.userId, r.unique]))
  const totalAvailable = totalRow?.total ?? 0
  const now = new Date()

  const previews = friendIds.map(fid => {
    const profile = profiles.find(p => p.user_id === fid)
    const msg = allMsgs.find(m => (m.sender_id === fid && m.receiver_id === uid) || (m.sender_id === uid && m.receiver_id === fid))
    return {
      friendId:           fid,
      username:           profile?.username ?? null,
      avatarUrl:          profile?.avatar_url ?? null,
      lastMessage:        msg?.content ?? null,
      lastAt:             msg?.created_at ?? null,
      lastFromMe:         msg?.sender_id === uid,
      unread:             unreadMap[fid] ?? 0,
      lastSeenAt:         profile?.last_seen_at ?? null,
      role:               profile?.role ?? null,
      collectionComplete: totalAvailable > 0 && (uniqueMap[fid] ?? 0) >= totalAvailable,
      is_subscriber:      !!profile?.is_subscriber && (!profile.subscriber_until || new Date(profile.subscriber_until) > now),
    }
  })

  previews.sort((a, b) => {
    if (a.lastAt && b.lastAt) return b.lastAt.localeCompare(a.lastAt)
    if (a.lastAt) return -1
    if (b.lastAt) return 1
    return 0
  })

  return NextResponse.json(previews, {
    headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=20' },
  })
}
