import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerDailyMissions, playerProfiles } from '@/lib/db/schema'
import { and, eq, sql, count } from 'drizzle-orm'
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

  // Vérifier si toutes les missions du jour sont maintenant réclamées → bonus 60 mana
  const [claimedRow] = await db
    .select({ total: count() })
    .from(playerDailyMissions)
    .where(and(
      eq(playerDailyMissions.userId, uid),
      eq(playerDailyMissions.date, date),
      eq(playerDailyMissions.claimed, true),
    ))

  const allClaimed = (claimedRow?.total ?? 0) >= missions.length
  if (allClaimed) {
    // Vérifier qu'on n'a pas déjà accordé le bonus aujourd'hui
    const bonusKey = `daily_bonus:${uid}:${date}`
    const [existing] = await db.select().from(playerDailyMissions)
      .where(and(eq(playerDailyMissions.userId, uid), eq(playerDailyMissions.date, date), eq(playerDailyMissions.missionId, bonusKey)))
    if (!existing) {
      await db.batch([
        db.insert(playerDailyMissions).values({ userId: uid, date, missionId: bonusKey, progress: 1, claimed: true, claimedAt: now }),
        db.update(playerProfiles)
          .set({ mana: sql`${playerProfiles.mana} + 60`, updatedAt: now })
          .where(eq(playerProfiles.userId, uid)),
      ])
      return NextResponse.json({ ok: true, xp_gained: mission.xp, bonus_mana: 60 })
    }
  }

  return NextResponse.json({ ok: true, xp_gained: mission.xp })
}
