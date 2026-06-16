import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { gameChallenges } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const row = await db.query.gameChallenges.findFirst({ where: eq(gameChallenges.id, id) })
  if (!row) return NextResponse.json({ error: 'Challenge introuvable.' }, { status: 404 })

  return NextResponse.json(row)
}
