import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { arenaBackgrounds } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'

const DEFAULT = {
  id: 'default',
  name: 'Néant VOID',
  imageUrl: '/assets/bg-void.png',
  gradient: 'linear-gradient(180deg, #050210 0%, #08031a 50%, #050210 100%)',
  active: true,
  orderIndex: 0,
  price: 0,
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  try {
    if (id) {
      const row = await db.select().from(arenaBackgrounds).where(eq(arenaBackgrounds.id, id)).limit(1)
      return NextResponse.json(row[0] ?? DEFAULT)
    }
    const rows = await db.select().from(arenaBackgrounds)
      .where(eq(arenaBackgrounds.active, true))
      .orderBy(asc(arenaBackgrounds.orderIndex))
    return NextResponse.json(rows.length ? rows : [DEFAULT])
  } catch {
    return NextResponse.json(id ? DEFAULT : [DEFAULT])
  }
}
