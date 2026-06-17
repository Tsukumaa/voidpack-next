import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { friendships, playerProfiles } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json([], { status: 401 })
  const uid = session.user.id

  // direction = 'received' (par défaut) → demandes reçues ; 'sent' → demandes envoyées
  const direction = req.nextUrl.searchParams.get('direction') ?? 'received'
  const sent = direction === 'sent'

  const rows = await db
    .select()
    .from(friendships)
    .where(and(
      eq(sent ? friendships.senderId : friendships.receiverId, uid),
      eq(friendships.status, 'pending'),
    ))

  if (!rows.length) return NextResponse.json([])

  const otherIds = rows.map(r => sent ? r.receiverId : r.senderId)
  const profiles = await db.query.playerProfiles.findMany({
    where: (t, { inArray }) => inArray(t.userId, otherIds),
  })

  return NextResponse.json(rows.map(r => {
    const otherId = sent ? r.receiverId : r.senderId
    const profile = profiles.find(p => p.userId === otherId)
    return {
      friendshipId: r.id,
      senderId:     r.senderId,
      receiverId:   r.receiverId,
      userId:       otherId,
      username:     profile?.username ?? null,
      avatarUrl:    profile?.avatarUrl ?? null,
    }
  }))
}
