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

  return NextResponse.json(missions.map(m => {
    const progress = rowMap[m.id]?.progress ?? 0
    return {
      mission_id: m.id,
      progress,
      completed: progress >= m.goal,
      claimed:   rowMap[m.id]?.claimed ?? false,
    }
  }))
}

// POST — incrémente le progress d'une mission
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid  = session.user.id
  const date = todayStr()

  const body = await req.json() as
    | { missionId: string; count?: number }
    | { events: { missionId: string; count?: number }[] }

  // Accepte un événement unique OU un tableau d'événements (batch)
  const events = 'events' in body
    ? body.events
    : [{ missionId: body.missionId, count: body.count }]

  const missions = getTodayMissions()

  for (const ev of events) {
    const count   = ev.count ?? 1
    const mission = missions.find(m => m.id === ev.missionId)
    if (!mission) continue // mission pas active aujourd'hui, on ignore

    await db
      .insert(playerDailyMissions)
      .values({ userId: uid, date, missionId: ev.missionId, progress: count })
      .onConflictDoUpdate({
        target: [playerDailyMissions.userId, playerDailyMissions.date, playerDailyMissions.missionId],
        set: {
          progress:  sql`MIN(${playerDailyMissions.progress} + ${count}, ${mission.goal})`,
          updatedAt: new Date().toISOString(),
        },
      })
  }

  return NextResponse.json({ ok: true })
}
