import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { marketOffers } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

// Retirer un de ses trades publics (aucune carte n'est mise de côté : rien à rendre)
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [row] = await db.update(marketOffers)
    .set({ status: 'cancelled' })
    .where(and(eq(marketOffers.id, id), eq(marketOffers.sellerId, session.user.id), eq(marketOffers.status, 'open')))
    .returning({ id: marketOffers.id })
  if (!row) return NextResponse.json({ error: 'Ce trade n\'est plus actif.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
