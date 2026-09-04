import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { marketOffers, playerCards } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const uid = session.user.id

  const offer = await db.query.marketOffers.findFirst({ where: eq(marketOffers.id, id) })
  if (!offer || offer.status !== 'open')
    return NextResponse.json({ error: 'Offre introuvable ou déjà traitée.' }, { status: 404 })
  if (offer.sellerId === uid)
    return NextResponse.json({ error: 'Tu ne peux pas accepter ta propre offre.' }, { status: 400 })

  // Vérifier que l'acheteur possède la carte voulue
  const buyerOwns = await db.query.playerCards.findFirst({
    where: and(eq(playerCards.userId, uid), eq(playerCards.cardId, offer.wantedCardKey)),
  })
  if (!buyerOwns || buyerOwns.count < 1)
    return NextResponse.json({ error: "Tu ne possèdes pas la carte demandée." }, { status: 400 })

  // Vérifier que le vendeur possède encore la carte offerte
  const sellerOwns = await db.query.playerCards.findFirst({
    where: and(eq(playerCards.userId, offer.sellerId), eq(playerCards.cardId, offer.offeredCardKey)),
  })
  if (!sellerOwns || sellerOwns.count < 1)
    return NextResponse.json({ error: "Le vendeur ne possède plus cette carte." }, { status: 400 })

  // Échange : retirer de chaque joueur, ajouter à l'autre
  // Offerte : seller → buyer
  if (sellerOwns.count <= 1) {
    await db.delete(playerCards).where(and(eq(playerCards.userId, offer.sellerId), eq(playerCards.cardId, offer.offeredCardKey)))
  } else {
    await db.update(playerCards).set({ count: sellerOwns.count - 1 })
      .where(and(eq(playerCards.userId, offer.sellerId), eq(playerCards.cardId, offer.offeredCardKey)))
  }
  await db.insert(playerCards)
    .values({ userId: uid, cardId: offer.offeredCardKey, rarity: offer.offeredRarity, family: sellerOwns.family, count: 1 })
    .onConflictDoUpdate({ target: [playerCards.userId, playerCards.cardId], set: { count: sellerOwns.count } })

  // Voulue : buyer → seller
  if (buyerOwns.count <= 1) {
    await db.delete(playerCards).where(and(eq(playerCards.userId, uid), eq(playerCards.cardId, offer.wantedCardKey)))
  } else {
    await db.update(playerCards).set({ count: buyerOwns.count - 1 })
      .where(and(eq(playerCards.userId, uid), eq(playerCards.cardId, offer.wantedCardKey)))
  }
  await db.insert(playerCards)
    .values({ userId: offer.sellerId, cardId: offer.wantedCardKey, rarity: offer.wantedRarity ?? buyerOwns.rarity, family: buyerOwns.family, count: 1 })
    .onConflictDoUpdate({ target: [playerCards.userId, playerCards.cardId], set: { count: buyerOwns.count } })

  // Marquer l'offre comme acceptée
  await db.update(marketOffers)
    .set({ status: 'accepted', buyerId: uid, acceptedAt: new Date().toISOString() })
    .where(eq(marketOffers.id, id))

  return NextResponse.json({ ok: true })
}
