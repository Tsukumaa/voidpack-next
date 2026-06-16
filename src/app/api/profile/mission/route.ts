import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { DAILY_MISSIONS } from '@/lib/game/achievements'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId } = await req.json()
  const mission = (DAILY_MISSIONS as Array<{ id: string; xp: number }>).find(m => m.id === missionId)
  if (!mission) return NextResponse.json({ error: 'Mission introuvable.' }, { status: 404 })

  const xpGained = mission.xp
  const uid = session.user.id

  const profile = await db.query.playerProfiles.findFirst({
    where: eq(playerProfiles.userId, uid),
  })

  const newXp = (profile?.xp ?? 0) + xpGained

  await db
    .update(playerProfiles)
    .set({ xp: newXp, updatedAt: new Date().toISOString() })
    .where(eq(playerProfiles.userId, uid))

  return NextResponse.json({ ok: true, xp_gained: xpGained })
}
