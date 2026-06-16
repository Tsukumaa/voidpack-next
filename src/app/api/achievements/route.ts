import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerAchievements } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json([], { status: 401 })

  const rows = await db
    .select()
    .from(playerAchievements)
    .where(eq(playerAchievements.userId, session.user.id))

  return NextResponse.json(rows)
}
