import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { friendships, playerProfiles, gameSessions } from '@/lib/db/schema'
import { eq, or, and, sql, count } from 'drizzle-orm'
import { playerCards, customCards } from '@/lib/db/schema'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json([], { status: 401 })
  const uid = session.user.id
  const full = req.nextUrl.searchParams.get('full') === '1'

  // full=1 → retourne accepted + pendingReceived + pendingSent en une requête
  if (full) {
    const allRows = await db.select().from(friendships)
      .where(or(eq(friendships.senderId, uid), eq(friendships.receiverId, uid)))

    const accepted       = allRows.filter(r => r.status === 'accepted')
    const pendingReceived = allRows.filter(r => r.status === 'pending' && r.receiverId === uid)
    const pendingSent    = allRows.filter(r => r.status === 'pending' && r.senderId === uid)

    const friendIds = accepted.map(r => r.senderId === uid ? r.receiverId : r.senderId)
    const pendingOtherIds = [...pendingReceived.map(r => r.senderId), ...pendingSent.map(r => r.receiverId)]
    const allIds = [...new Set([...friendIds, ...pendingOtherIds])]

    const [profiles, [totalRow], uniqueRows, activeSessions] = await Promise.all([
      allIds.length ? db.query.playerProfiles.findMany({ where: (t, { inArray }) => inArray(t.userId, allIds) }) : [],
      db.select({ total: count() }).from(customCards),
      friendIds.length
        ? db.select({ userId: playerCards.userId, unique: sql<number>`COUNT(DISTINCT ${playerCards.cardId})` })
            .from(playerCards)
            .where(sql`${playerCards.userId} IN (${sql.join(friendIds.map(id => sql`${id}`), sql`, `)})`)
            .groupBy(playerCards.userId)
        : [],
      friendIds.length
        ? db.select({ id: gameSessions.id, player1Id: gameSessions.player1Id, player2Id: gameSessions.player2Id })
            .from(gameSessions)
            .where(and(
              eq(gameSessions.status, 'active'),
              sql`(${gameSessions.player1Id} IN (${sql.join(friendIds.map(id => sql`${id}`), sql`, `)}) OR ${gameSessions.player2Id} IN (${sql.join(friendIds.map(id => sql`${id}`), sql`, `)}))`
            ))
        : [],
    ])

    const totalAvailable = (totalRow as { total: number } | undefined)?.total ?? 0
    const uniqueMap = Object.fromEntries((uniqueRows as { userId: string; unique: number }[]).map(r => [r.userId, r.unique]))
    const sessionOf = (id: string) => (activeSessions as { id: string; player1Id: string; player2Id: string }[]).find(s => s.player1Id === id || s.player2Id === id)?.id ?? null
    const profileOf = (id: string) => (profiles as { userId: string; username?: string | null; avatarUrl?: string | null }[]).find(p => p.userId === id)

    return NextResponse.json({
      accepted: accepted.map(r => {
        const friendId = r.senderId === uid ? r.receiverId : r.senderId
        const p = profileOf(friendId)
        return { friendshipId: r.id, userId: friendId, username: p?.username, avatarUrl: p?.avatarUrl, status: 'accepted',
          collectionComplete: totalAvailable > 0 && (uniqueMap[friendId] ?? 0) >= totalAvailable,
          activeSessionId: sessionOf(friendId) }
      }),
      pendingReceived: pendingReceived.map(r => {
        const p = profileOf(r.senderId)
        return { friendshipId: r.id, senderId: r.senderId, receiverId: r.receiverId, userId: r.senderId, username: p?.username ?? null, avatarUrl: p?.avatarUrl ?? null }
      }),
      pendingSent: pendingSent.map(r => r.receiverId),
    })
  }

  const rows = await db
    .select()
    .from(friendships)
    .where(and(
      or(eq(friendships.senderId, uid), eq(friendships.receiverId, uid)),
      eq(friendships.status, 'accepted')
    ))

  const friendIds = rows.map(r => r.senderId === uid ? r.receiverId : r.senderId)
  if (!friendIds.length) return NextResponse.json([])

  const [profiles, [totalRow], uniqueRows, activeSessions] = await Promise.all([
    db.query.playerProfiles.findMany({ where: (t, { inArray }) => inArray(t.userId, friendIds) }),
    db.select({ total: count() }).from(customCards),
    db.select({ userId: playerCards.userId, unique: sql<number>`COUNT(DISTINCT ${playerCards.cardId})` })
      .from(playerCards)
      .where(sql`${playerCards.userId} IN (${sql.join(friendIds.map(id => sql`${id}`), sql`, `)})`)
      .groupBy(playerCards.userId),
    db.select({ id: gameSessions.id, player1Id: gameSessions.player1Id, player2Id: gameSessions.player2Id })
      .from(gameSessions)
      .where(and(
        eq(gameSessions.status, 'active'),
        sql`(${gameSessions.player1Id} IN (${sql.join(friendIds.map(id => sql`${id}`), sql`, `)}) OR ${gameSessions.player2Id} IN (${sql.join(friendIds.map(id => sql`${id}`), sql`, `)}))`
      )),
  ])
  const totalAvailable = totalRow?.total ?? 0
  const uniqueMap = Object.fromEntries(uniqueRows.map(r => [r.userId, r.unique]))
  const sessionOf = (uid: string) => activeSessions.find(s => s.player1Id === uid || s.player2Id === uid)?.id ?? null

  const result = rows.map(r => {
    const friendId = r.senderId === uid ? r.receiverId : r.senderId
    const profile  = profiles.find(p => p.userId === friendId)
    const unique   = uniqueMap[friendId] ?? 0
    return {
      friendshipId: r.id,
      userId: friendId,
      username: profile?.username,
      avatarUrl: profile?.avatarUrl,
      status: r.status,
      collectionComplete: totalAvailable > 0 && unique >= totalAvailable,
      activeSessionId: sessionOf(friendId),
    }
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
  const uid = session.user.id

  const [row] = await db.select().from(friendships).where(eq(friendships.id, friendshipId)).limit(1)

  await db
    .update(friendships)
    .set({ status: accept ? 'accepted' : 'blocked', updatedAt: new Date().toISOString() })
    .where(eq(friendships.id, friendshipId))

  if (accept && row) {
    const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    for (const u of [uid, row.senderId]) {
      fetch(`${base}/api/profile/missions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId: 'add_friend', count: 1 }),
      }).catch(() => {})
      fetch(`${base}/api/achievements/check`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rarities: [], totalPacks: 0, uniqueCards: 0, level: 1, _uid: u }),
      }).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { friendshipId } = await req.json()
  await db.delete(friendships).where(eq(friendships.id, friendshipId))
  return NextResponse.json({ ok: true })
}
