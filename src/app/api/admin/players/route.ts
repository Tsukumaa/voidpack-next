import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerProfiles, boosterCredits, settings } from '@/lib/db/schema'
import { ilike, or, desc, eq, inArray } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.isAdmin) return NextResponse.json([], { status: 403 })

  const search = req.nextUrl.searchParams.get('q')
  const rows = await db
    .select()
    .from(playerProfiles)
    .orderBy(desc(playerProfiles.xp))
    .limit(200)

  // Load owned arenas for all players in one query
  const userIds = rows.map(p => p.userId)
  const arenaKeys = userIds.map(id => `owned_arenas:${id}`)
  const arenaSettings = userIds.length > 0
    ? await db.select().from(settings).where(inArray(settings.key, arenaKeys))
    : []
  const arenaMap = Object.fromEntries(arenaSettings.map(s => [s.key, JSON.parse(s.value ?? '[]')]))

  const filtered = (search
    ? rows.filter(p => p.username?.toLowerCase().includes(search.toLowerCase()))
    : rows
  ).map(p => ({
    user_id:             p.userId,
    username:            p.username,
    avatar_url:          p.avatarUrl,
    role:                p.role ?? null,
    level:               p.level,
    xp:                  p.xp,
    packs_opened:        p.packsOpened,
    highest_rarity:      p.highestRarity,
    void_pulls:          p.voidPulls,
    current_streak:      p.currentStreak,
    best_streak:         p.bestStreak,
    twitch_login:        p.twitchLogin,
    unlocked_card_backs: null,
    owned_arenas:        (arenaMap[`owned_arenas:${p.userId}`] ?? []) as string[],
  }))

  return NextResponse.json(filtered)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action, userId, data } = await req.json()

  if (action === 'update_role') {
    const role = data?.role ?? null
    await db.update(playerProfiles).set({ role }).where(eq(playerProfiles.userId, userId))
    return NextResponse.json({ ok: true })
  }

  if (action === 'credit_booster') {
    const { boosterType, qty, source } = data
    const rows = Array.from({ length: qty }, () => ({
      userId,
      boosterType: boosterType ?? 'void',
      source:      source ?? 'admin',
      createdBy:   session.user.id,
    }))
    await db.insert(boosterCredits).values(rows)
    return NextResponse.json({ ok: true })
  }

  if (action === 'update_card_backs') {
    await db
      .update(playerProfiles)
      .set({ updatedAt: new Date().toISOString() })
      .where(eq(playerProfiles.userId, userId))
    return NextResponse.json({ ok: true })
  }

  if (action === 'update_arenas') {
    const { ownedArenas } = data as { ownedArenas: string[] }
    const key = `owned_arenas:${userId}`
    await db
      .insert(settings)
      .values({ key, value: JSON.stringify(ownedArenas) })
      .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(ownedArenas) } })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
