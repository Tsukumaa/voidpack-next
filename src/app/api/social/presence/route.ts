import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { dbClient } from '@/lib/db'

async function ensureColumn() {
  try {
    await dbClient.execute('ALTER TABLE player_profiles ADD COLUMN last_seen_at TEXT')
  } catch { /* already exists */ }
}

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false })
  await ensureColumn()
  await dbClient.execute({
    sql: `UPDATE player_profiles SET last_seen_at = datetime('now') WHERE user_id = ?`,
    args: [session.user.id],
  })
  return NextResponse.json({ ok: true })
}
