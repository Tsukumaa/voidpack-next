import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { boosterCodeRedemptions } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = Number(req.nextUrl.searchParams.get('limit') ?? '20')

  const rows = await db.query.boosterCodeRedemptions.findMany({
    where: eq(boosterCodeRedemptions.userId, session.user.id),
    orderBy: [desc(boosterCodeRedemptions.redeemedAt)],
    limit,
  })

  return NextResponse.json(rows)
}
