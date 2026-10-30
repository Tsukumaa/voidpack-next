import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { checkFeature } from '@/lib/features'
import { hasHiddenCard } from '@/lib/cache/cards-cache'
import { db } from '@/lib/db'
import { marketOffers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { TradeError, acceptPublicTrade } from '@/lib/game/public-trades'

// Accepter un trade public : échange des deux cartes en une transaction
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const blocked = await checkFeature('feature_trading')
  if (blocked) return blocked
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const offer = await db.query.marketOffers.findFirst({ where: eq(marketOffers.id, id), columns: { offeredCardKey: true, wantedCardKey: true } })
  if (offer && await hasHiddenCard(offer.offeredCardKey, offer.wantedCardKey))
    return NextResponse.json({ error: 'Cette carte n\'est plus disponible.' }, { status: 400 })

  try {
    await acceptPublicTrade(session.user.id, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TradeError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('public trade accept error:', e)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
