import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerProfiles, playerCards, friendships } from '@/lib/db/schema'
import { eq, and, or } from 'drizzle-orm'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const uid = session?.user?.id ?? null

  const profile = await db.query.playerProfiles.findFirst({
    where: eq(playerProfiles.userId, id),
  })
  if (!profile) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const collection = await db
    .select()
    .from(playerCards)
    .where(eq(playerCards.userId, id))

  let friendship: { status: string; friendshipId: number | null } = { status: 'none', friendshipId: null }
  if (uid && uid !== id) {
    const rel = await db
      .select()
      .from(friendships)
      .where(or(
        and(eq(friendships.senderId, uid), eq(friendships.receiverId, id)),
        and(eq(friendships.senderId, id), eq(friendships.receiverId, uid)),
      ))
      .limit(1)
    if (rel.length) {
      const r = rel[0]
      friendship = {
        friendshipId: r.id,
        status:
          r.status === 'accepted' ? 'accepted'
          : r.status === 'pending' ? (r.senderId === uid ? 'pending_sent' : 'pending_received')
          : r.status,
      }
    }
  }

  return NextResponse.json({
    isSelf: uid === id,
    profile: {
      userId:        profile.userId,
      username:      profile.username,
      role:          profile.role ?? null,
      avatarUrl:     profile.avatarUrl,
      level:         profile.level,
      xp:            profile.xp,
      highestRarity: profile.highestRarity,
      favoriteCards: (profile.favoriteCards as string[] | null) ?? [],
      currentStreak: profile.currentStreak ?? 0,
    },
    collection,
    friendship,
  })
}
