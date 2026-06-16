import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'

export async function GET() {
  const rows = await db.select().from(settings)
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = r.value
  return NextResponse.json(map)
}
