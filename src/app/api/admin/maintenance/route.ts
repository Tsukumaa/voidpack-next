import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!(session?.user as { isAdmin?: boolean })?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { enabled } = await req.json() as { enabled: boolean }
  const value = enabled ? 'true' : 'false'

  await db.run(sql.raw(`INSERT INTO settings (key, value) VALUES ('maintenance_mode', '${value}') ON CONFLICT(key) DO UPDATE SET value='${value}'`))

  return NextResponse.json({ ok: true })
}
