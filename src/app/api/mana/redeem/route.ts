import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerProfiles, boosterCredits } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export const BOOSTER_MANA_COST = 180

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = session.user.id

  const profile = await db.query.playerProfiles.findFirst({ where: eq(playerProfiles.userId, uid) })
  if (!profile) return NextResponse.json({ error: 'profile_not_found' }, { status: 404 })
  if ((profile.mana ?? 0) < BOOSTER_MANA_COST) {
    return NextResponse.json({ error: 'not_enough_mana', current: profile.mana, needed: BOOSTER_MANA_COST }, { status: 400 })
  }

  await db.batch([
    db.update(playerProfiles)
      .set({ mana: sql`${playerProfiles.mana} - ${BOOSTER_MANA_COST}`, updatedAt: new Date().toISOString() })
      .where(eq(playerProfiles.userId, uid)),
    db.insert(boosterCredits).values({
      userId:      uid,
      boosterType: 'void',
      source:      'mana_shop',
      sourceRef:   `mana_${uid}_${Date.now()}`,
    }),
  ])

  const updated = await db.query.playerProfiles.findFirst({ where: eq(playerProfiles.userId, uid) })
  return NextResponse.json({ ok: true, manaRemaining: updated?.mana ?? 0 })
}
