import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'
import { VOID_DAY_KEY } from '@/lib/events'

const FEATURE_KEYS = [
  'feature_combat_multiplayer',
  'feature_combat_training',
  'feature_pack_opening',
  'feature_trading',
  'feature_social',
  'feature_shop',
]

// Événements : désactivés par défaut, activés seulement si la valeur vaut 'true'
const EVENT_KEYS = [VOID_DAY_KEY]

export async function GET() {
  const rows = await db.select().from(settings).where(inArray(settings.key, [...FEATURE_KEYS, ...EVENT_KEYS]))
  const map: Record<string, boolean> = {}
  // Par défaut tout est activé
  for (const key of FEATURE_KEYS) map[key] = true
  for (const key of EVENT_KEYS) map[key] = false
  for (const row of rows) {
    if (FEATURE_KEYS.includes(row.key)) map[row.key] = row.value !== 'false'
    if (EVENT_KEYS.includes(row.key))   map[row.key] = row.value === 'true'
  }
  return NextResponse.json(map, { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } })
}
