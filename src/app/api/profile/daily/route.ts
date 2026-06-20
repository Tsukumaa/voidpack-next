import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerDailyRewards, boosterCredits, playerProfiles, playerAchievements } from '@/lib/db/schema'
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

  const newBestStreak = Math.max(newStreak, existing?.bestStreak ?? 0)

  const isStreakBonus = newStreak % 7 === 0

  const inserts = [
    db.insert(boosterCredits).values({ userId: uid, boosterType: 'void', source: 'daily_reward' }),
  ]
  if (isStreakBonus) {
    inserts.push(db.insert(boosterCredits).values({ userId: uid, boosterType: 'void', source: 'streak_bonus' }))
  }

  await Promise.all([
    db.insert(playerDailyRewards)
      .values({ userId: uid, lastClaimAt: now.toISOString(), currentStreak: newStreak, bestStreak: newBestStreak })
      .onConflictDoUpdate({
        target: playerDailyRewards.userId,
        set: { lastClaimAt: now.toISOString(), currentStreak: newStreak, bestStreak: newBestStreak, updatedAt: now.toISOString() },
      }),
    db.update(playerProfiles)
      .set({ currentStreak: newStreak, bestStreak: newBestStreak, updatedAt: now.toISOString() })
      .where(eq(playerProfiles.userId, uid)),
    ...inserts,
  ])

  // Débloquer les succès de streak
  const streakAchievements: string[] = []
  if (newStreak >= 3)  streakAchievements.push('streak_3')
  if (newStreak >= 7)  streakAchievements.push('streak_7')
  if (newStreak >= 30) streakAchievements.push('streak_30')

  if (streakAchievements.length) {
    await db.insert(playerAchievements)
      .values(streakAchievements.map(id => ({ userId: uid, achievementId: id })))
      .onConflictDoNothing()
  }

  return NextResponse.json({ ok: true, streak: newStreak, streakBonus: isStreakBonus })
}
