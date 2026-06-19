import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

async function ensureColumn() {
  try {
    await db.run(sql`ALTER TABLE player_profiles ADD COLUMN last_seen_at TEXT`)
  } catch { /* already exists */ }
}

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false })
  await ensureColumn()
  await db.run(sql`UPDATE player_profiles SET last_seen_at = datetime('now') WHERE user_id = ${session.user.id}`)
  return NextResponse.json({ ok: true })
}
