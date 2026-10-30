import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { marketListings, playerProfiles } from '@/lib/db/schema'
import { and, desc, eq, gt, inArray, ne } from 'drizzle-orm'
import { checkFeature } from '@/lib/features'
import { getCachedAllCards, getHiddenCardIds } from '@/lib/cache/cards-cache'
import {
  MARKET_COMMISSION, MARKET_MAX_PRICE, MarketError, createListing, expireListings, marketMinPrice,
} from '@/lib/game/market'

// GET — ventes ouvertes des autres joueurs + mes ventes en cours + mes dernières ventes conclues
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = session.user.id

  await expireListings()
  const now = new Date().toISOString()

  const [browseRows, mineRows, soldRows, hidden, profile] = await Promise.all([
    db.select().from(marketListings)
      .where(and(eq(marketListings.status, 'open'), ne(marketListings.sellerId, uid), gt(marketListings.expiresAt, now)))
      .orderBy(desc(marketListings.createdAt)).limit(200),
    db.select().from(marketListings)
      .where(and(eq(marketListings.sellerId, uid), eq(marketListings.status, 'open')))
      .orderBy(desc(marketListings.createdAt)),
    db.select().from(marketListings)
      .where(and(eq(marketListings.sellerId, uid), eq(marketListings.status, 'sold')))
      .orderBy(desc(marketListings.closedAt)).limit(10),
    getHiddenCardIds(),
    db.query.playerProfiles.findFirst({ where: eq(playerProfiles.userId, uid), columns: { mana: true } }),
  ])

  // Cartes masquées par l'admin : retirées de la vente affichée
  const browse = browseRows.filter(l => !hidden.has(l.cardId))

  const userIds = [...new Set([...browse.map(l => l.sellerId), ...soldRows.map(l => l.buyerId).filter((x): x is string => !!x)])]
  const profiles = userIds.length
    ? await db.select({ userId: playerProfiles.userId, username: playerProfiles.username, avatarUrl: playerProfiles.avatarUrl })
        .from(playerProfiles).where(inArray(playerProfiles.userId, userIds))
    : []
  const pMap = Object.fromEntries(profiles.map(p => [p.userId, p]))

  return NextResponse.json({
    commission: MARKET_COMMISSION,
    mana: profile?.mana ?? 0,
    browse: browse.map(l => ({
      ...l,
      sellerUsername:  pMap[l.sellerId]?.username ?? 'Joueur',
      sellerAvatarUrl: pMap[l.sellerId]?.avatarUrl ?? null,
    })),
    mine: mineRows,
    sold: soldRows.map(l => ({ ...l, buyerUsername: (l.buyerId && pMap[l.buyerId]?.username) || 'Joueur' })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST — mettre une carte en vente : { cardId, price }
export async function POST(req: NextRequest) {
  const blocked = await checkFeature('feature_trading')
  if (blocked) return blocked
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = session.user.id

  const { cardId, price: rawPrice } = await req.json() as { cardId?: string; price?: number }
  const price = Math.floor(Number(rawPrice))
  if (!cardId || !Number.isFinite(price)) return NextResponse.json({ error: 'Champs requis manquants.' }, { status: 400 })

  const [cards, hidden] = await Promise.all([getCachedAllCards(), getHiddenCardIds()])
  const card = cards.find(c => c.id === cardId)
  if (!card || hidden.has(cardId)) return NextResponse.json({ error: 'Cette carte n\'est pas disponible.' }, { status: 400 })
  // Cartes promo (exclusives) : trophées, non vendables
  if (card.exclusive || card.rarity === 'promo') return NextResponse.json({ error: 'Les cartes promo ne peuvent pas être vendues.' }, { status: 400 })

  const min = marketMinPrice(card.rarity)
  if (price < min) return NextResponse.json({ error: `Prix minimum pour cette rareté : ${min} mana.` }, { status: 400 })
  if (price > MARKET_MAX_PRICE) return NextResponse.json({ error: `Prix maximum : ${MARKET_MAX_PRICE} mana.` }, { status: 400 })

  try {
    const listing = await createListing(uid, { id: card.id, rarity: card.rarity, family: card.family }, price)
    return NextResponse.json({ ok: true, ...listing })
  } catch (e) {
    if (e instanceof MarketError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('market create error:', e)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
