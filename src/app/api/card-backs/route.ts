import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cardBacks } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'

const DEFAULT = {
  id: 'default',
  name: 'VOID Pack',
  gradient: 'linear-gradient(135deg, #1a0b2e 0%, #4a1fa8 50%, #2a0a4d 100%)',
  pattern: 'radial-gradient(circle at 50% 50%, rgba(123,43,255,0.25), transparent 60%)',
  imageUrl: null,
  active: true,
  orderIndex: 0,
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  try {
    if (id) {
      const row = await db.select().from(cardBacks).where(eq(cardBacks.id, id)).limit(1)
      return NextResponse.json(row[0] ?? DEFAULT)
    }
    const rows = await db.select().from(cardBacks)
      .where(eq(cardBacks.active, true))
      .orderBy(asc(cardBacks.orderIndex))
    return NextResponse.json(rows.length ? rows : [DEFAULT])
  } catch {
    return NextResponse.json(id ? DEFAULT : [DEFAULT])
  }
}
