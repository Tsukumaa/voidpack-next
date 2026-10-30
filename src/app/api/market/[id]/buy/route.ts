import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { checkFeature } from '@/lib/features'
import { hasHiddenCard } from '@/lib/cache/cards-cache'
import { db } from '@/lib/db'
import { marketListings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { MarketError, buyListing } from '@/lib/game/market'

// Achat d'une carte en vente : l'acheteur paie en mana, le vendeur reçoit le prix moins la commission
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const blocked = await checkFeature('feature_trading')
  if (blocked) return blocked
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // Carte masquée par l'admin depuis la mise en vente : achat bloqué
  const listing = await db.query.marketListings.findFirst({ where: eq(marketListings.id, id), columns: { cardId: true } })
  if (listing && await hasHiddenCard(listing.cardId))
    return NextResponse.json({ error: 'Cette carte n\'est plus disponible.' }, { status: 400 })

  try {
    const result = await buyListing(session.user.id, id)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    if (e instanceof MarketError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('market buy error:', e)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
