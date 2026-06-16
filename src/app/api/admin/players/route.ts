import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerProfiles, boosterCredits } from '@/lib/db/schema'
import { ilike, or, desc, eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.isAdmin) return NextResponse.json([], { status: 403 })

  const search = req.nextUrl.searchParams.get('q')
  const rows = await db
    .select()
    .from(playerProfiles)
    .orderBy(desc(playerProfiles.xp))
    .limit(200)

  const filtered = search
    ? rows.filter(p => p.username?.toLowerCase().includes(search.toLowerCase()))
    : rows

  return NextResponse.json(filtered)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action, userId, data } = await req.json()

  if (action === 'credit_booster') {
    const { boosterType, qty, source } = data
    const rows = Array.from({ length: qty }, () => ({
      userId,
      boosterType: boosterType ?? 'void',
      source:      source ?? 'admin',
      createdBy:   session.user.id,
    }))
    await db.insert(boosterCredits).values(rows)
    return NextResponse.json({ ok: true })
  }

  if (action === 'update_card_backs') {
    await db
      .update(playerProfiles)
      .set({ updatedAt: new Date().toISOString() })
      .where(eq(playerProfiles.userId, userId))
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
