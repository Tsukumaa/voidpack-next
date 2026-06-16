import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { gameChallenges } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  await db.update(gameChallenges)
    .set({ status: 'declined', updatedAt: new Date().toISOString() })
    .where(and(eq(gameChallenges.id, id), eq(gameChallenges.challengedId, session.user.id)))

  return NextResponse.json({ ok: true })
}
