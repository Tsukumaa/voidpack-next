import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { friendships, playerProfiles } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json([], { status: 401 })

  const rows = await db
    .select()
    .from(friendships)
    .where(and(
      eq(friendships.receiverId, session.user.id),
      eq(friendships.status, 'pending')
    ))

  if (!rows.length) return NextResponse.json([])

  const senderIds = rows.map(r => r.senderId)
  const profiles = await db.query.playerProfiles.findMany({
    where: (t, { inArray }) => inArray(t.userId, senderIds),
  })

  return NextResponse.json(rows.map(r => {
    const profile = profiles.find(p => p.userId === r.senderId)
    return {
      friendshipId: r.id,
      senderId:     r.senderId,
      username:     profile?.username ?? null,
      avatarUrl:    profile?.avatarUrl ?? null,
    }
  }))
}
