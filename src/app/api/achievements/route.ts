import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerAchievements, playerProfiles, playerDailyRewards } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json([], { status: 401 })
  const uid = session.user.id

  // Vérification rétroactive des succès streak — lit les deux tables et prend le max
  const [profile, dailyRow] = await Promise.all([
    db.query.playerProfiles.findFirst({ where: eq(playerProfiles.userId, uid) }),
    db.query.playerDailyRewards.findFirst({ where: eq(playerDailyRewards.userId, uid) }),
  ])
  const streak = Math.max(profile?.currentStreak ?? 0, dailyRow?.currentStreak ?? 0)

  const toUnlock: string[] = []
  if (streak >= 3)  toUnlock.push('streak_3')
  if (streak >= 7)  toUnlock.push('streak_7')
  if (streak >= 30) toUnlock.push('streak_30')

  if (toUnlock.length) {
    await db.insert(playerAchievements)
      .values(toUnlock.map(id => ({ userId: uid, achievementId: id })))
      .onConflictDoNothing()
  }

  const rows = await db
    .select()
    .from(playerAchievements)
    .where(eq(playerAchievements.userId, uid))

  return NextResponse.json(rows, {
    headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  })
}
