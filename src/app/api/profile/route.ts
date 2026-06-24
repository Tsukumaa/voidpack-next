import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerProfiles, adminUsers, playerCards, customCards, settings } from '@/lib/db/schema'
import { eq, count, sql } from 'drizzle-orm'
import { isSubscriberActive, consumePendingForUser } from '@/lib/kofi/grant'

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
    mana:                p.mana ?? 0,
    current_streak:      p.currentStreak,
    best_streak:         p.bestStreak,
    twitch_id:           p.twitchId,
    twitch_login:        p.twitchLogin,
    is_admin:            isAdmin,
    is_subscriber:       isSubscriberActive(p as { isSubscriber?: boolean | null; subscriberUntil?: string | null }),
    subscriber_until:    p.subscriberUntil ?? null,
    kofi_email:          p.kofiEmail ?? null,
    role:                p.role ?? null,
    selected_card_back:  p.selectedCardBack ?? null,
    unlocked_card_backs: null,
    auto_reveal:         p.autoReveal ?? false,
    favorite_cards:      (p.favoriteCards as string[] | null) ?? [],
    created_at:          p.createdAt,
    updated_at:          p.updatedAt,
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  const uid = session.user.id

  const [profile, admin, [totalRow], [uniqueRow], ownedArenasRow] = await Promise.all([
    db.query.playerProfiles.findFirst({ where: eq(playerProfiles.userId, uid) }),
    db.query.adminUsers.findFirst({ where: eq(adminUsers.discordId, uid) }),
    db.select({ total: count() }).from(customCards),
    db.select({ unique: sql<number>`COUNT(DISTINCT ${playerCards.cardId})` })
      .from(playerCards).where(eq(playerCards.userId, uid)),
    db.select({ value: settings.value }).from(settings).where(eq(settings.key, `owned_arenas:${uid}`)).limit(1),
  ])
  const collectionComplete = (totalRow?.total ?? 0) > 0 && (uniqueRow?.unique ?? 0) >= (totalRow?.total ?? 0)
  const ownedArenas: string[] = ownedArenasRow[0]?.value ? JSON.parse(ownedArenasRow[0].value) : []

  return NextResponse.json({ ...toSnake(profile as unknown as Record<string, unknown>, !!admin), collection_complete: collectionComplete, owned_arenas: ownedArenas })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const patch = await req.json()
  const allowed = ['username', 'avatarUrl', 'selectedCardBack', 'autoReveal', 'favoriteCards', 'kofiEmail'] as const
  const safe: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  for (const key of allowed) {
    if (key in patch) safe[key] = patch[key]
  }

  const [updated] = await db
    .update(playerProfiles)
    .set(safe)
    .where(eq(playerProfiles.userId, session.user.id))
    .returning()

  // Si l'user vient de renseigner son email Ko-fi → applique les paiements en attente
  if ('kofiEmail' in patch && typeof patch.kofiEmail === 'string' && patch.kofiEmail.trim()) {
    await consumePendingForUser(session.user.id, patch.kofiEmail).catch(e => console.error('consumePending error:', e))
  }

  return NextResponse.json(updated ?? null)
}
