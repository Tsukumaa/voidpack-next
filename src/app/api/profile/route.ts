import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  const profile = await db.query.playerProfiles.findFirst({
    where: eq(playerProfiles.userId, session.user.id),
  })
  return NextResponse.json(profile ?? null)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const patch = await req.json()
  const allowed = ['username', 'avatarUrl', 'selectedCardBack'] as const
  const safe: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  for (const key of allowed) {
    if (key in patch) safe[key] = patch[key]
  }

  const [updated] = await db
    .update(playerProfiles)
    .set(safe)
    .where(eq(playerProfiles.userId, session.user.id))
    .returning()

  return NextResponse.json(updated ?? null)
}
