import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { MarketError, cancelListing } from '@/lib/game/market'

// Retrait d'une vente par son vendeur : la carte revient dans sa collection
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    await cancelListing(session.user.id, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof MarketError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('market cancel error:', e)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
