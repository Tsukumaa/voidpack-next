import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { gameChallenges } from '@/lib/db/schema'
import { eq, or, and } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid    = session.user.id
  const status = req.nextUrl.searchParams.get('status') ?? 'pending'

  const rows = await db.query.gameChallenges.findMany({
    where: and(
      eq(gameChallenges.challengedId, uid),
      eq(gameChallenges.status, status),
    ),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  })

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { challengedId, deck } = await req.json()
  if (!challengedId) return NextResponse.json({ error: 'challengedId requis.' }, { status: 400 })

  const [row] = await db.insert(gameChallenges)
    .values({
      challengerId: session.user.id,
      challengedId,
      deck:    JSON.stringify(deck ?? []),
      status:  'pending',
    })
    .returning()

  return NextResponse.json(row)
}
