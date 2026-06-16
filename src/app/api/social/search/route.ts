import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerProfiles } from '@/lib/db/schema'
import { like, ne } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json([], { status: 401 })

  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) return NextResponse.json([])

  const rows = await db
    .select({ userId: playerProfiles.userId, username: playerProfiles.username, avatarUrl: playerProfiles.avatarUrl })
    .from(playerProfiles)
    .where(like(playerProfiles.username, `%${q}%`))
    .limit(10)

  return NextResponse.json(rows.filter(r => r.userId !== session.user.id))
}
