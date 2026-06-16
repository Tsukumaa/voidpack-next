import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { tradeOffers } from '@/lib/db/schema'
import { eq, or, and } from 'drizzle-orm'

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

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { receiverId, offeredCardId, offeredCardKey, offeredRarity, wantedCardKey, wantedCardName, wantedRarity, message } = await req.json()

  if (!receiverId || !offeredCardId || !offeredCardKey || !offeredRarity || !wantedCardKey) {
    return NextResponse.json({ error: 'Champs requis manquants.' }, { status: 400 })
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()

  const [row] = await db.insert(tradeOffers)
    .values({
      senderId:      session.user.id,
      receiverId,
      offeredCardId,
      offeredCardKey,
      offeredRarity,
      wantedCardKey,
      wantedCardName: wantedCardName ?? null,
      wantedRarity:   wantedRarity   ?? null,
      message:        message        ?? null,
      expiresAt,
    })
    .returning()

  return NextResponse.json(row)
}
