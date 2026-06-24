import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerProfiles, boosterCredits } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

function xpForLevel(lvl: number) {
  return Math.floor(200 * Math.pow(1.18, lvl - 1))
}

function computeLevel(totalXp: number): number {
  let level = 1
  let cumulative = 0
  while (true) {
    const needed = xpForLevel(level)
    if (totalXp < cumulative + needed) break
    cumulative += needed
    level++
  }
  return level
}

// Multiples de 5 entre oldLevel+1 et newLevel inclus
function levelMilestonesReached(oldLevel: number, newLevel: number): number[] {
  const milestones: number[] = []
  for (let l = oldLevel + 1; l <= newLevel; l++) {
    if (l % 5 === 0) milestones.push(l)
  }
  return milestones
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { xp: xpGain } = await req.json()
  const uid = session.user.id

  const profile = await db.query.playerProfiles.findFirst({
    where: eq(playerProfiles.userId, uid),
  })

  const oldLevel = profile?.level ?? 1
  const newXp    = (profile?.xp ?? 0) + xpGain
  const newLevel = computeLevel(newXp)

  const [updated] = await db
    .update(playerProfiles)
    .set({ xp: newXp, level: newLevel, updatedAt: new Date().toISOString() })
    .where(eq(playerProfiles.userId, uid))
    .returning({ level: playerProfiles.level, xp: playerProfiles.xp })

  // Booster offert tous les 5 niveaux
  const milestones = levelMilestonesReached(oldLevel, newLevel)
  for (const lvl of milestones) {
    await db.insert(boosterCredits).values({
      userId:      uid,
      boosterType: 'void',
      source:      'level_reward',
      sourceRef:   `level_reward_${uid}_${lvl}`,
    }).onConflictDoNothing()
  }

  return NextResponse.json({
    ...(updated ?? { level: newLevel, xp: newXp }),
    level_rewards: milestones,
  })
}
