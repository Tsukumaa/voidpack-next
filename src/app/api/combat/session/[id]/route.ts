import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { gameSessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, id) })
  if (!session) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(session)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authSession = await auth()
  if (!authSession?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await db.delete(gameSessions).where(eq(gameSessions.id, id))
  return NextResponse.json({ ok: true })
}
