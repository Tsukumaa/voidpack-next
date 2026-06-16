import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Stores selected card back per user in settings table as "card_back:{userId}"
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cardBackId } = await req.json()
  if (!cardBackId) return NextResponse.json({ error: 'cardBackId manquant.' }, { status: 400 })

  const key = `card_back:${session.user.id}`

  await db
    .insert(settings)
    .values({ key, value: cardBackId })
    .onConflictDoUpdate({ target: settings.key, set: { value: cardBackId } })

  return NextResponse.json({ ok: true })
}
