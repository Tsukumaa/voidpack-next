import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

const TTL = 2 * 60 * 1000 // 2 min
const cache = new Map<string, { value: boolean; ts: number }>()

async function isFeatureEnabled(key: string): Promise<boolean> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < TTL) return hit.value
  const row = await db.select().from(settings).where(eq(settings.key, key)).limit(1).then(r => r[0])
  const value = row ? row.value !== 'false' : true
  cache.set(key, { value, ts: Date.now() })
  return value
}

export function invalidateFeaturesCache() {
  cache.clear()
}

export async function checkFeature(key: string): Promise<NextResponse | null> {
  const enabled = await isFeatureEnabled(key)
  if (!enabled) return NextResponse.json({ error: 'feature_disabled' }, { status: 503 })
  return null
}
