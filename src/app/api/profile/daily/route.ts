import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerDailyRewards, boosterCredits } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = session.user.id

  const now = new Date()
  const existing = await db.query.playerDailyRewards.findFirst({
    where: eq(playerDailyRewards.userId, uid),
  })

  if (existing?.lastClaimAt) {
    const lastClaim = new Date(existing.lastClaimAt)
    const hoursDiff = (now.getTime() - lastClaim.getTime()) / (1000 * 3600)
    if (hoursDiff < 20) return NextResponse.json({ error: 'Already claimed today' }, { status: 400 })
  }

  const lastWasYesterday = existing?.lastClaimAt
    ? (now.getTime() - new Date(existing.lastClaimAt).getTime()) < 48 * 3600 * 1000
    : false

  const newStreak = lastWasYesterday ? (existing?.currentStreak ?? 0) + 1 : 1

  await db.insert(playerDailyRewards)
    .values({ userId: uid, lastClaimAt: now.toISOString(), currentStreak: newStreak, bestStreak: Math.max(newStreak, existing?.bestStreak ?? 0) })
    .onConflictDoUpdate({
      target: playerDailyRewards.userId,
      set: { lastClaimAt: now.toISOString(), currentStreak: newStreak, bestStreak: Math.max(newStreak, existing?.bestStreak ?? 0), updatedAt: now.toISOString() },
    })

  // Give a booster credit
  await db.insert(boosterCredits).values({
    userId:      uid,
    boosterType: 'void',
    source:      'daily_reward',
  })

  return NextResponse.json({ ok: true, streak: newStreak })
}
