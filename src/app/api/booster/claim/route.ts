import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { boosterCredits } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()

  const [credit] = await db
    .update(boosterCredits)
    .set({ claimed: true, claimedAt: new Date().toISOString() })
    .where(and(
      eq(boosterCredits.id, id),
      eq(boosterCredits.userId, session.user.id),
      eq(boosterCredits.claimed, false)
    ))
    .returning()

  if (!credit) return NextResponse.json({ error: 'Credit not found or already claimed' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
