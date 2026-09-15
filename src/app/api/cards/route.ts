import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'
import { customCards, families } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const getPublicCards = unstable_cache(
  async () => {
    const activeFamilies = (await db.select({ key: families.key }).from(families).where(eq(families.active, true))).map(f => f.key)
    return (await db.select().from(customCards)).filter(c => c.family === 'global' || activeFamilies.includes(c.family))
  },
  ['public-cards'],
  { revalidate: 300, tags: ['public-cards'] },
)

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin') === '1') {
    return NextResponse.json(await db.select().from(customCards))
  }

  const cards = await getPublicCards()

  return NextResponse.json(cards, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' },
  })
}
