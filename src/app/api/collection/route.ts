import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerCards } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json([], { status: 401 })

  const rows = await db
    .select()
    .from(playerCards)
    .where(eq(playerCards.userId, session.user.id))
    .orderBy(desc(playerCards.obtainedAt))

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cards: Array<{ cardId: string; rarity: string; family: string; metadata?: string }> = await req.json()

  const rows = cards.map(c => ({
    userId:   session.user.id,
    cardId:   c.cardId,
    rarity:   c.rarity,
    family:   c.family ?? 'global',
    metadata: c.metadata ?? '{}',
  }))

  const inserted = await db.insert(playerCards).values(rows).returning()
  return NextResponse.json(inserted)
}
