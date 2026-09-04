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

  const uid  = session.user.id
  const mine = req.nextUrl.searchParams.get('mine') === '1'

  let rows
  if (mine) {
    rows = await db.query.marketOffers.findMany({
      where: eq(marketOffers.sellerId, uid),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    })
  } else {
    rows = await db.query.marketOffers.findMany({
      where: and(eq(marketOffers.status, 'open'), ne(marketOffers.sellerId, uid)),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    })
  }

  // Enrichir avec le profil du vendeur
  const sellerIds = [...new Set(rows.map(r => r.sellerId))]
  const profiles = sellerIds.length
    ? await db.select({ userId: playerProfiles.userId, username: playerProfiles.username, avatarUrl: playerProfiles.avatarUrl })
        .from(playerProfiles).where(inArray(playerProfiles.userId, sellerIds))
    : []
  const profileMap = Object.fromEntries(profiles.map(p => [p.userId, p]))

  // Filtrer les offres dont le vendeur ne possède plus la carte
  const withProfile = rows.map(r => ({
    ...r,
    sellerUsername:  profileMap[r.sellerId]?.username  ?? r.sellerId,
    sellerAvatarUrl: profileMap[r.sellerId]?.avatarUrl ?? null,
  }))

  // Pour les offres ouvertes, vérifier que le vendeur possède encore la carte
  if (!mine) {
    const ownershipChecks = await Promise.all(
      withProfile.map(r =>
        db.query.playerCards.findFirst({
          where: and(eq(playerCards.userId, r.sellerId), eq(playerCards.cardId, r.offeredCardKey)),
        }).then(owned => ({ id: r.id, owned: !!(owned && owned.count > 0) }))
      )
    )
    const ownedSet = new Set(ownershipChecks.filter(c => c.owned).map(c => c.id))
    return NextResponse.json(withProfile.filter(r => ownedSet.has(r.id)))
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
