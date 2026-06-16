import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerProfiles } from '@/lib/db/schema'
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

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { xp: xpGain } = await req.json()
  const uid = session.user.id

  const profile = await db.query.playerProfiles.findFirst({
    where: eq(playerProfiles.userId, uid),
  })

  const newXp    = (profile?.xp ?? 0) + xpGain
  const newLevel = computeLevel(newXp)

  const [updated] = await db
    .update(playerProfiles)
    .set({ xp: newXp, level: newLevel, updatedAt: new Date().toISOString() })
    .where(eq(playerProfiles.userId, uid))
    .returning({ level: playerProfiles.level, xp: playerProfiles.xp })

  return NextResponse.json(updated ?? { level: newLevel, xp: newXp })
}
