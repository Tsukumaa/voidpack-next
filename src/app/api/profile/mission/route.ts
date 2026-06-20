import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerDailyMissions, playerProfiles } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { getTodayMissions } from '@/lib/game/achievements'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid  = session.user.id
  const date = todayStr()

  const { missionId } = await req.json()
  const missions = getTodayMissions()
  const mission  = missions.find(m => m.id === missionId)
  if (!mission) return NextResponse.json({ error: 'Mission introuvable.' }, { status: 404 })

  // Vérifier en DB : mission complétée et pas encore réclamée
  const [row] = await db
    .select()
    .from(playerDailyMissions)
    .where(and(
      eq(playerDailyMissions.userId, uid),
      eq(playerDailyMissions.date, date),
      eq(playerDailyMissions.missionId, missionId),
    ))

  if (row?.claimed) return NextResponse.json({ error: 'already_claimed' }, { status: 409 })
  if ((row?.progress ?? 0) < mission.goal) return NextResponse.json({ error: 'not_completed' }, { status: 400 })

  const now = new Date().toISOString()

  // Marquer comme réclamée + créditer XP
  await db.batch([
    db.update(playerDailyMissions)
      .set({ claimed: true, claimedAt: now, updatedAt: now })
      .where(and(
        eq(playerDailyMissions.userId, uid),
        eq(playerDailyMissions.date, date),
        eq(playerDailyMissions.missionId, missionId),
      )),
    db.update(playerProfiles)
      .set({ xp: sql`${playerProfiles.xp} + ${mission.xp}`, updatedAt: now })
      .where(eq(playerProfiles.userId, uid)),
  ])

  return NextResponse.json({ ok: true, xp_gained: mission.xp })
}
