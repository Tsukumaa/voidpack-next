import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { marketOffers, playerCards, playerProfiles } from '@/lib/db/schema'
import { and, count, desc, eq, gt, inArray, isNull, lte, ne, or } from 'drizzle-orm'
import { checkFeature } from '@/lib/features'
import { getCachedAllCards, getHiddenCardIds } from '@/lib/cache/cards-cache'
import { PUBLIC_TRADE_DURATION_DAYS, PUBLIC_TRADE_MAX_OPEN } from '@/lib/game/public-trades'

// GET — trades publics ouverts des autres joueurs + les miens
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = session.user.id
  const now = new Date().toISOString()
  const notExpired = or(isNull(marketOffers.expiresAt), gt(marketOffers.expiresAt, now))

  // Trades publics arrivés à expiration : vraiment fermés (statut "expired"), pas juste masqués
  await db.update(marketOffers)
    .set({ status: 'expired' })
    .where(and(eq(marketOffers.status, 'open'), lte(marketOffers.expiresAt, now)))

  const [browseRows, mineRows, hidden] = await Promise.all([
    db.select().from(marketOffers)
      .where(and(eq(marketOffers.status, 'open'), ne(marketOffers.sellerId, uid), notExpired))
      .orderBy(desc(marketOffers.createdAt)).limit(100),
    db.select().from(marketOffers)
      .where(and(eq(marketOffers.status, 'open'), eq(marketOffers.sellerId, uid), notExpired))
      .orderBy(desc(marketOffers.createdAt)),
    getHiddenCardIds(),
  ])
  const visible = (r: { offeredCardKey: string; wantedCardKey: string }) => !hidden.has(r.offeredCardKey) && !hidden.has(r.wantedCardKey)
  let browse = browseRows.filter(visible)

  // N'affiche que les trades dont le joueur possède encore la carte offerte (1 requête)
  if (browse.length) {
    const owned = await db.select({ userId: playerCards.userId, cardId: playerCards.cardId })
      .from(playerCards)
      .where(and(
        inArray(playerCards.userId, [...new Set(browse.map(r => r.sellerId))]),
        inArray(playerCards.cardId, [...new Set(browse.map(r => r.offeredCardKey))]),
        gt(playerCards.count, 0),
      ))
    const ownedSet = new Set(owned.map(o => `${o.userId}:${o.cardId}`))
    browse = browse.filter(r => ownedSet.has(`${r.sellerId}:${r.offeredCardKey}`))
  }

  const sellerIds = [...new Set(browse.map(r => r.sellerId))]
  const profiles = sellerIds.length
    ? await db.select({ userId: playerProfiles.userId, username: playerProfiles.username, avatarUrl: playerProfiles.avatarUrl })
        .from(playerProfiles).where(inArray(playerProfiles.userId, sellerIds))
    : []
  const pMap = Object.fromEntries(profiles.map(p => [p.userId, p]))

  return NextResponse.json({
    browse: browse.map(r => ({ ...r, sellerUsername: pMap[r.sellerId]?.username ?? 'Joueur', sellerAvatarUrl: pMap[r.sellerId]?.avatarUrl ?? null })),
    mine: mineRows.filter(visible),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST — publier un trade public : { offeredCardKey, wantedCardKey, message? }
export async function POST(req: NextRequest) {
  const blocked = await checkFeature('feature_trading')
  if (blocked) return blocked
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = session.user.id

  const { offeredCardKey, wantedCardKey, message } = await req.json() as { offeredCardKey?: string; wantedCardKey?: string; message?: string }
  if (!offeredCardKey || !wantedCardKey) return NextResponse.json({ error: 'Champs requis manquants.' }, { status: 400 })
  if (offeredCardKey === wantedCardKey) return NextResponse.json({ error: 'Choisis deux cartes différentes.' }, { status: 400 })

  const [cards, hidden] = await Promise.all([getCachedAllCards(), getHiddenCardIds()])
  const offered = cards.find(c => c.id === offeredCardKey)
  const wanted  = cards.find(c => c.id === wantedCardKey)
  if (!offered || !wanted || hidden.has(offeredCardKey) || hidden.has(wantedCardKey))
    return NextResponse.json({ error: 'Cette carte n\'est pas disponible.' }, { status: 400 })
  if (offered.exclusive || offered.rarity === 'promo' || wanted.exclusive || wanted.rarity === 'promo')
    return NextResponse.json({ error: 'Les cartes promo ne peuvent pas être échangées.' }, { status: 400 })

  const [owned, [open]] = await Promise.all([
    db.query.playerCards.findFirst({ where: and(eq(playerCards.userId, uid), eq(playerCards.cardId, offeredCardKey)) }),
    db.select({ n: count() }).from(marketOffers).where(and(eq(marketOffers.sellerId, uid), eq(marketOffers.status, 'open'))),
  ])
  if (!owned || owned.count < 1) return NextResponse.json({ error: 'Tu ne possèdes pas cette carte.' }, { status: 400 })
  if ((open?.n ?? 0) >= PUBLIC_TRADE_MAX_OPEN)
    return NextResponse.json({ error: `Tu as déjà ${PUBLIC_TRADE_MAX_OPEN} trades publics en cours.` }, { status: 400 })

  const expiresAt = new Date(Date.now() + PUBLIC_TRADE_DURATION_DAYS * 86400_000).toISOString()
  const [row] = await db.insert(marketOffers).values({
    sellerId: uid,
    offeredCardKey, offeredRarity: owned.rarity,
    wantedCardKey, wantedRarity: wanted.rarity, wantedCardName: wanted.name,
    message: message?.trim().slice(0, 200) || null,
    expiresAt,
  }).returning()
  return NextResponse.json({ ok: true, offer: row })
}
