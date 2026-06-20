import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { savedDecks } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json([], { status: 401 })

  const decks = await db.select().from(savedDecks)
    .where(eq(savedDecks.userId, session.user.id))
  return NextResponse.json(decks)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, name, cards, totalCards, totalMana } = await req.json()
  if (!name || !cards) return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })

  if (id) {
    // Update existing deck
    await db.update(savedDecks)
      .set({ name, cards: JSON.stringify(cards), totalCards, totalMana, updatedAt: new Date().toISOString() })
      .where(and(eq(savedDecks.id, id), eq(savedDecks.userId, session.user.id)))
    return NextResponse.json({ ok: true, id })
  }

  // Create new deck
  const [deck] = await db.insert(savedDecks)
    .values({ userId: session.user.id, name, cards: JSON.stringify(cards), totalCards, totalMana })
    .returning()
  return NextResponse.json({ ok: true, id: deck.id })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await db.delete(savedDecks)
    .where(and(eq(savedDecks.id, id), eq(savedDecks.userId, session.user.id)))
  return NextResponse.json({ ok: true })
}
