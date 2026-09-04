import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'

export async function GET() {
  const rows = await db.select().from(settings)
    .where(inArray(settings.key, ['announcement_title', 'announcement_body', 'announcement_active_since']))

  const map = Object.fromEntries(rows.map(r => [r.key, r.value]))
  const since = map['announcement_active_since']

  if (!since) return NextResponse.json({ active: false })

  return NextResponse.json({
    active: true,
    since,
    title: map['announcement_title'] ?? '',
    body:  map['announcement_body']  ?? '',
  })
}
