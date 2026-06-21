import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'

const FEATURE_KEYS = [
  'feature_combat_multiplayer',
  'feature_combat_training',
  'feature_pack_opening',
  'feature_trading',
  'feature_social',
  'feature_shop',
]

export const dynamic = 'force-dynamic'

export async function GET() {
  const rows = await db.select().from(settings).where(inArray(settings.key, FEATURE_KEYS))
  const map: Record<string, boolean> = {}
  // Par défaut tout est activé
  for (const key of FEATURE_KEYS) map[key] = true
  for (const row of rows) {
    if (FEATURE_KEYS.includes(row.key)) map[row.key] = row.value !== 'false'
  }
  return NextResponse.json(map, { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } })
}
