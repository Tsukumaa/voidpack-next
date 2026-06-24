import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerAchievements, playerDailyRewards, combatStats, friendships, tradeOffers } from '@/lib/db/schema'
import { eq, and, or, count } from 'drizzle-orm'
import { ACHIEVEMENTS } from '@/lib/game/achievements'

async function grantAchievementXp(uid: string, ids: string[]) {
  if (!ids.length) return
  await db.insert(playerAchievements)
    .values(ids.map(id => ({ userId: uid, achievementId: id })))
    .onConflictDoNothing()
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })

  const { rarities, totalPacks, uniqueCards, level } = await req.json()
  const uid = session.user.id

  const toUnlock: string[] = []

  // ── Boosters ────────────────────────────────────────────────────────────
  if (totalPacks >= 1)   toUnlock.push('open_first')
  if (totalPacks >= 10)  toUnlock.push('open_10')
  if (totalPacks >= 50)  toUnlock.push('open_50')
  if (totalPacks >= 100) toUnlock.push('open_100')
  if (totalPacks >= 500) toUnlock.push('open_500')

  // ── Raretés ─────────────────────────────────────────────────────────────
  if (rarities.some((r: string) => ['rare','epic','legendary','void'].includes(r))) toUnlock.push('get_rare')
  if (rarities.some((r: string) => ['epic','legendary','void'].includes(r)))        toUnlock.push('get_epic')
  if (rarities.some((r: string) => ['legendary','void'].includes(r)))               toUnlock.push('get_legendary')
  if (rarities.includes('void'))                                                     toUnlock.push('get_void')

  // ── Collection ──────────────────────────────────────────────────────────
  if (uniqueCards >= 10)  toUnlock.push('cards_10')
  if (uniqueCards >= 25)  toUnlock.push('cards_25')
  if (uniqueCards >= 50)  toUnlock.push('cards_50')
  if (uniqueCards >= 100) toUnlock.push('cards_100')

  // ── Niveaux ─────────────────────────────────────────────────────────────
  if (level >= 5)  toUnlock.push('level_5')
  if (level >= 10) toUnlock.push('level_10')
  if (level >= 25) toUnlock.push('level_25')
  if (level >= 50) toUnlock.push('level_50')

  // ── Streak (lecture DB) ─────────────────────────────────────────────────
  const daily = await db.query.playerDailyRewards.findFirst({ where: eq(playerDailyRewards.userId, uid) })
  const streak = Math.max(daily?.currentStreak ?? 0, daily?.bestStreak ?? 0)
  if (streak >= 3)   toUnlock.push('streak_3')
  if (streak >= 7)   toUnlock.push('streak_7')
  if (streak >= 30)  toUnlock.push('streak_30')
  if (streak >= 100) toUnlock.push('streak_100')

  // ── Combat (lecture DB) ─────────────────────────────────────────────────
  const combat = await db.query.combatStats.findFirst({ where: eq(combatStats.userId, uid) })
  const wins = combat?.wins ?? 0
  if (wins >= 1)  toUnlock.push('win_1')
  if (wins >= 10) toUnlock.push('win_10')
  if (wins >= 50) toUnlock.push('win_50')

  // ── Social (amis acceptés) ──────────────────────────────────────────────
  const [{ total: friendCount }] = await db.select({ total: count() }).from(friendships)
    .where(and(eq(friendships.status, 'accepted'), or(eq(friendships.senderId, uid), eq(friendships.receiverId, uid))))
  if (friendCount >= 1) toUnlock.push('friend_1')
  if (friendCount >= 5) toUnlock.push('friend_5')

  // ── Trading (échanges acceptés) ─────────────────────────────────────────
  const [{ total: tradeCount }] = await db.select({ total: count() }).from(tradeOffers)
    .where(and(eq(tradeOffers.status, 'accepted'), or(eq(tradeOffers.senderId, uid), eq(tradeOffers.receiverId, uid))))
  if (tradeCount >= 1)  toUnlock.push('trade_1')
  if (tradeCount >= 10) toUnlock.push('trade_10')

  // ── Unlock + XP ─────────────────────────────────────────────────────────
  // Filtrer les succès déjà débloqués
  const existing = await db.select({ achievementId: playerAchievements.achievementId })
    .from(playerAchievements).where(eq(playerAchievements.userId, uid))
  const existingIds = new Set(existing.map(e => e.achievementId))
  const newOnes = toUnlock.filter(id => !existingIds.has(id))

  await grantAchievementXp(uid, newOnes)

  // Calculer l'XP à accorder pour les nouveaux succès
  const xpGained = newOnes.reduce((sum, id) => {
    const def = ACHIEVEMENTS.find(a => a.id === id)
    return sum + (def?.xp ?? 0)
  }, 0)

  if (xpGained > 0) {
    await fetch(`${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/profile/xp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xp: xpGained }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, unlocked: newOnes, xp_gained: xpGained })
}
