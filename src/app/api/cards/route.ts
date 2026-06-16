import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { customCards } from '@/lib/db/schema'

export async function GET() {
  const cards = await db.select().from(customCards)
  return NextResponse.json(cards)
}
