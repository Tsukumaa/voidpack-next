import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerDailyMissions, playerProfiles } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getTodayMissions } from '@/lib/game/achievements'
import { sql } from 'drizzle-orm'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// GET — retourne les missions du jour avec leur état
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid  = session.user.id
  const date = todayStr()
  const missions = getTodayMissions()

  const rows = await db
    .select()
    .from(playerDailyMissions)
    .where(and(eq(playerDailyMissions.userId, uid), eq(playerDailyMissions.date, date)))

  const rowMap = Object.fromEntries(rows.map(r => [r.missionId, r]))

  return NextResponse.json(missions.map(m => ({
    mission_id: m.id,
    progress:   rowMap[m.id]?.progress ?? 0,
    claimed:    rowMap[m.id]?.claimed  ?? false,
  })))
}

// POST — incrémente le progress d'une mission
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid  = session.user.id
  const date = todayStr()

  const { missionId, count = 1 } = await req.json() as { missionId: string; count?: number }
  const missions = getTodayMissions()
  const mission  = missions.find(m => m.id === missionId)
  if (!mission) return NextResponse.json({ ok: true }) // mission pas active aujourd'hui, on ignore

  await db
    .insert(playerDailyMissions)
    .values({ userId: uid, date, missionId, progress: count })
    .onConflictDoUpdate({
      target: [playerDailyMissions.userId, playerDailyMissions.date, playerDailyMissions.missionId],
      set: {
        progress:  sql`MIN(${playerDailyMissions.progress} + ${count}, ${mission.goal})`,
        updatedAt: new Date().toISOString(),
      },
    })

  const [row] = await db
    .select()
    .from(playerDailyMissions)
    .where(and(eq(playerDailyMissions.userId, uid), eq(playerDailyMissions.date, date), eq(playerDailyMissions.missionId, missionId)))

  return NextResponse.json({ ok: true, progress: row?.progress ?? count })
}
