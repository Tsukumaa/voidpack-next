import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function checkFeature(key: string): Promise<NextResponse | null> {
  const row = await db.select().from(settings).where(eq(settings.key, key)).limit(1).then(r => r[0])
  const enabled = row ? row.value !== 'false' : true
  if (!enabled) return NextResponse.json({ error: 'feature_disabled' }, { status: 503 })
  return null
}
