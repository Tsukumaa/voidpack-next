import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerProfiles, adminUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

function toSnake(p: Record<string, unknown> | null, isAdmin: boolean) {
  if (!p) return null
  return {
    user_id:             p.userId,
    username:            p.username,
    avatar_url:          p.avatarUrl,
    level:               p.level,
    xp:                  p.xp,
    packs_opened:        p.packsOpened,
    highest_rarity:      p.highestRarity,
    void_pulls:          p.voidPulls,
    current_streak:      p.currentStreak,
    best_streak:         p.bestStreak,
    twitch_id:           p.twitchId,
    twitch_login:        p.twitchLogin,
    is_admin:            isAdmin,
    selected_card_back:  p.selectedCardBack ?? null,
    unlocked_card_backs: null,
    created_at:          p.createdAt,
    updated_at:          p.updatedAt,
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  const uid = session.user.id

  const [profile, admin] = await Promise.all([
    db.query.playerProfiles.findFirst({ where: eq(playerProfiles.userId, uid) }),
    db.query.adminUsers.findFirst({ where: eq(adminUsers.discordId, uid) }),
  ])

  return NextResponse.json(toSnake(profile as unknown as Record<string, unknown>, !!admin))
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const patch = await req.json()
  const allowed = ['username', 'avatarUrl', 'selectedCardBack'] as const
  const safe: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  for (const key of allowed) {
    if (key in patch) safe[key] = patch[key]
  }

  const [updated] = await db
    .update(playerProfiles)
    .set(safe)
    .where(eq(playerProfiles.userId, session.user.id))
    .returning()

  return NextResponse.json(updated ?? null)
}
