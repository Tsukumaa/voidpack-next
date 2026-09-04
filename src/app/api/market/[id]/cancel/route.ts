import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { marketOffers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const uid = session.user.id

  const offer = await db.query.marketOffers.findFirst({ where: eq(marketOffers.id, id) })
  if (!offer || offer.status !== 'open')
    return NextResponse.json({ error: 'Offre introuvable.' }, { status: 404 })
  if (offer.sellerId !== uid)
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })

  await db.update(marketOffers).set({ status: 'cancelled' }).where(and(eq(marketOffers.id, id), eq(marketOffers.sellerId, uid)))
  return NextResponse.json({ ok: true })
}
