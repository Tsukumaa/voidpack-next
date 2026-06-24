import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { customCards, families } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const isAdmin = req.headers.get('x-admin') === '1'

  if (isAdmin) {
    return NextResponse.json(await db.select().from(customCards))
  }

  const activeFamilies = (await db.select({ key: families.key }).from(families).where(eq(families.active, true))).map(f => f.key)
  const cards = (await db.select().from(customCards)).filter(c => c.family === 'global' || activeFamilies.includes(c.family))

  return NextResponse.json(cards, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' },
  })
}
