import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerDailyRewards } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  const row = await db.query.playerDailyRewards.findFirst({
    where: eq(playerDailyRewards.userId, session.user.id),
  })

  return NextResponse.json({
    currentStreak: row?.currentStreak ?? 0,
    bestStreak:    row?.bestStreak ?? 0,
    lastClaimAt:   row?.lastClaimAt ?? null,
  })
}
