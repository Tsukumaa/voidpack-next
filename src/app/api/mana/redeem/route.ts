import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerProfiles, boosterCredits } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { BOOSTER_MANA_COST } from '@/lib/game/mana-constants'
import { isVoidDayActive, VOID_DAY_REF_SUFFIX } from '@/lib/events'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = session.user.id

  let family = 'void'
  try { const body = await req.json(); if (body?.family) family = String(body.family) } catch {}

  const [profile, voidDay] = await Promise.all([
    db.query.playerProfiles.findFirst({ where: eq(playerProfiles.userId, uid) }),
    isVoidDayActive(),
  ])
  if (!profile) return NextResponse.json({ error: 'profile_not_found' }, { status: 404 })
  if ((profile.mana ?? 0) < BOOSTER_MANA_COST) {
    return NextResponse.json({ error: 'not_enough_mana', current: profile.mana, needed: BOOSTER_MANA_COST }, { status: 400 })
  }

  const sourceRef = `mana_${uid}_${Date.now()}`
  const credits = [{ userId: uid, boosterType: family, source: 'mana_shop', sourceRef }]
  // Void Day : un booster identique offert
  if (voidDay) credits.push({ ...credits[0], sourceRef: sourceRef + VOID_DAY_REF_SUFFIX })

  const [[updatedProfile]] = await db.batch([
    db.update(playerProfiles)
      .set({ mana: sql`${playerProfiles.mana} - ${BOOSTER_MANA_COST}`, updatedAt: new Date().toISOString() })
      .where(eq(playerProfiles.userId, uid))
      .returning({ mana: playerProfiles.mana }),
    db.insert(boosterCredits).values(credits),
  ])

  return NextResponse.json({ ok: true, manaRemaining: updatedProfile?.mana ?? 0, boosters: credits.length, voidDay })
}
