import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { marketOffers, playerCards, playerProfiles } from '@/lib/db/schema'
import { eq, and, inArray, ne } from 'drizzle-orm'
import { checkFeature } from '@/lib/features'

// GET — liste les offres ouvertes (sauf les siennes) + les siennes
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid   = session.user.id
  const mine  = req.nextUrl.searchParams.get('mine') === '1'
  const page  = Math.max(0, parseInt(req.nextUrl.searchParams.get('page') ?? '0', 10))
  const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10)))

  let rows
  if (mine) {
    rows = await db.query.marketOffers.findMany({
      where: eq(marketOffers.sellerId, uid),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit,
      offset: page * limit,
    })
  } else {
    rows = await db.query.marketOffers.findMany({
      where: and(eq(marketOffers.status, 'open'), ne(marketOffers.sellerId, uid)),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit,
      offset: page * limit,
    })
  }

  // Enrichir avec le profil du vendeur (1 query groupée)
  const sellerIds = [...new Set(rows.map(r => r.sellerId))]
  const profiles = sellerIds.length
    ? await db.select({ userId: playerProfiles.userId, username: playerProfiles.username, avatarUrl: playerProfiles.avatarUrl })
        .from(playerProfiles).where(inArray(playerProfiles.userId, sellerIds))
    : []
  const profileMap = Object.fromEntries(profiles.map(p => [p.userId, p]))

  const withProfile = rows.map(r => ({
    ...r,
    sellerUsername:  profileMap[r.sellerId]?.username  ?? r.sellerId,
    sellerAvatarUrl: profileMap[r.sellerId]?.avatarUrl ?? null,
  }))

  // Pour les offres ouvertes, vérifier ownership en 1 seule requête (au lieu de N)
  if (!mine && withProfile.length > 0) {
    const offeredKeys = [...new Set(withProfile.map(r => r.offeredCardKey))]
    const ownedCards = await db
      .select({ userId: playerCards.userId, cardId: playerCards.cardId, count: playerCards.count })
      .from(playerCards)
      .where(and(
        inArray(playerCards.userId, sellerIds),
        inArray(playerCards.cardId, offeredKeys),
      ))
    const ownedSet = new Set(
      ownedCards.filter(c => c.count > 0).map(c => `${c.userId}:${c.cardId}`)
    )
    return NextResponse.json(withProfile.filter(r => ownedSet.has(`${r.sellerId}:${r.offeredCardKey}`)))
  }

  return NextResponse.json(withProfile)
}

// POST — créer une offre
export async function POST(req: NextRequest) {
  const blocked = await checkFeature('feature_trading')
  if (blocked) return blocked
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = session.user.id
  const { offeredCardKey, offeredRarity, wantedCardKey, wantedCardName, wantedRarity, message } = await req.json()

  if (!offeredCardKey || !offeredRarity || !wantedCardKey)
    return NextResponse.json({ error: 'Champs requis manquants.' }, { status: 400 })

  const owned = await db.query.playerCards.findFirst({
    where: and(eq(playerCards.userId, uid), eq(playerCards.cardId, offeredCardKey)),
  })
  if (!owned || owned.count < 1)
    return NextResponse.json({ error: 'Tu ne possèdes pas cette carte.' }, { status: 400 })

  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
  const [row] = await db.insert(marketOffers)
    .values({ sellerId: uid, offeredCardKey, offeredRarity, wantedCardKey, wantedCardName: wantedCardName ?? null, wantedRarity: wantedRarity ?? null, message: message ?? null, expiresAt })
    .returning()

  return NextResponse.json(row)
}
