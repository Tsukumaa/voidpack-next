import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { gameActions } from '@/lib/db/schema'
import { eq, gt, and } from 'drizzle-orm'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const after = Number(req.nextUrl.searchParams.get('after') ?? 0)

  const rows = await db
    .select()
    .from(gameActions)
    .where(and(eq(gameActions.sessionId, id), gt(gameActions.id, after)))
    .orderBy(gameActions.id)

  return NextResponse.json(rows.map(r => ({
    ...r,
    seq:     r.id,
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
  })))
}
