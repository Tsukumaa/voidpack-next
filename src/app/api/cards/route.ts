import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { customCards } from '@/lib/db/schema'

export async function GET() {
  const cards = await db.select().from(customCards)
  return NextResponse.json(cards, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' },
  })
}
