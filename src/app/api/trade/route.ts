import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { tradeOffers, playerCards, playerProfiles } from '@/lib/db/schema'
import { eq, or, and, inArray } from 'drizzle-orm'
import { checkFeature } from '@/lib/features'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid    = session.user.id
  const status = req.nextUrl.searchParams.get('status') ?? 'pending'

  const rows = await db.query.tradeOffers.findMany({
    where: and(
      or(eq(tradeOffers.senderId, uid), eq(tradeOffers.receiverId, uid)),
      eq(tradeOffers.status, status),
    ),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  })

  // Enrichir avec username + avatarUrl des deux parties
  const userIds = [...new Set(rows.flatMap(r => [r.senderId, r.receiverId]))]
  const profiles = userIds.length
    ? await db.select({ userId: playerProfiles.userId, username: playerProfiles.username, avatarUrl: playerProfiles.avatarUrl })
        .from(playerProfiles).where(inArray(playerProfiles.userId, userIds))
    : []
  const profileMap = Object.fromEntries(profiles.map(p => [p.userId, p]))

  return NextResponse.json(rows.map(r => ({
    ...r,
    senderUsername:   profileMap[r.senderId]?.username   ?? r.senderId,
    senderAvatarUrl:  profileMap[r.senderId]?.avatarUrl  ?? null,
    receiverUsername: profileMap[r.receiverId]?.username ?? r.receiverId,
    receiverAvatarUrl: profileMap[r.receiverId]?.avatarUrl ?? null,
  })))
}

export async function POST(req: NextRequest) {
  const blocked = await checkFeature('feature_trading')
  if (blocked) return blocked
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { receiverId, offeredCardKey, offeredRarity, wantedCardKey, wantedCardName, wantedRarity, message } = await req.json()

  if (!receiverId || !offeredCardKey || !offeredRarity || !wantedCardKey) {
    return NextResponse.json({ error: 'Champs requis manquants.' }, { status: 400 })
  }

  const owned = await db.query.playerCards.findFirst({
    where: and(eq(playerCards.userId, session.user.id), eq(playerCards.cardId, offeredCardKey)),
  })
  if (!owned || owned.count < 1) {
    return NextResponse.json({ error: 'Tu ne possèdes pas cette carte.' }, { status: 400 })
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()

  const [row] = await db.insert(tradeOffers)
    .values({ senderId: session.user.id, receiverId, offeredCardKey, offeredRarity, wantedCardKey, wantedCardName: wantedCardName ?? null, wantedRarity: wantedRarity ?? null, message: message ?? null, expiresAt })
    .returning()

  return NextResponse.json(row)
}
