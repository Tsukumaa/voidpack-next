import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  friendships, directMessages, tradeOffers,
  gameChallenges, playerDailyMissions, playerDailyRewards,
  playerProfiles,
} from '@/lib/db/schema'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { getTodayMissions } from '@/lib/game/achievements'

// Endpoint combiné : remplace 6 polls séparés par 1 seul appel
// Retourne tout ce dont GlobalOverlay a besoin en une requête auth + queries parallèles
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })
  const uid = session.user.id

  const today = new Date().toISOString().split('T')[0]

  const [
    pendingFriends,
    unreadMessages,
    pendingTrades,
    pendingChallenges,
    missionRows,
    streakRow,
  ] = await Promise.all([
    // Demandes d'amis reçues
    db.select({ id: friendships.id })
      .from(friendships)
      .where(and(eq(friendships.receiverId, uid), eq(friendships.status, 'pending'))),

    // Messages non lus
    db.select({ id: directMessages.id, senderId: directMessages.senderId })
      .from(directMessages)
      .where(and(eq(directMessages.receiverId, uid), isNull(directMessages.readAt))),

    // Trades en attente (reçus)
    db.select({ id: tradeOffers.id })
      .from(tradeOffers)
      .where(and(eq(tradeOffers.receiverId, uid), eq(tradeOffers.status, 'pending'))),

    // Défis de combat reçus en attente
    db.select({ id: gameChallenges.id, challengerId: gameChallenges.challengerId })
      .from(gameChallenges)
      .where(and(eq(gameChallenges.challengedId, uid), eq(gameChallenges.status, 'pending'))),

    // Missions du jour
    db.select()
      .from(playerDailyMissions)
      .where(and(eq(playerDailyMissions.userId, uid), eq(playerDailyMissions.date, today))),

    // Streak / récompense journalière
    db.query.playerDailyRewards.findFirst({ where: eq(playerDailyRewards.userId, uid) }),
  ])

  // Enrichir les défis avec les usernames des challengers
  let challengesWithNames: { id: string; challengerId: string; challengerUsername: string | null }[] = []
  if (pendingChallenges.length) {
    const challengerIds = pendingChallenges.map(c => c.challengerId)
    const profiles = await db.select({ userId: playerProfiles.userId, username: playerProfiles.username })
      .from(playerProfiles)
      .where(inArray(playerProfiles.userId, challengerIds))
    const nameMap = Object.fromEntries(profiles.map(p => [p.userId, p.username]))
    challengesWithNames = pendingChallenges.map(c => ({
      id: c.id,
      challengerId: c.challengerId,
      challengerUsername: nameMap[c.challengerId] ?? null,
    }))
  }

  // unread bySender
  const bySender: Record<string, number> = {}
  for (const m of unreadMessages) {
    bySender[m.senderId] = (bySender[m.senderId] ?? 0) + 1
  }

  // badge profil : missions complétées non réclamées + récompense dispo
  const missions = getTodayMissions()
  const rowMap = Object.fromEntries(missionRows.map(r => [r.missionId, r]))
  const unclaimedMissions = missions.filter(m => {
    const row = rowMap[m.id]
    return row && row.progress >= (m as { goal: number }).goal && !row.claimed
  }).length
  const lastMs = streakRow?.lastClaimAt ? new Date(streakRow.lastClaimAt).getTime() : 0
  const dailyAvail = Date.now() - lastMs > 20 * 3600 * 1000 ? 1 : 0

  return NextResponse.json({
    pendingFriendCount:  pendingFriends.length,
    unreadMessageCount:  unreadMessages.length,
    unreadBySender:      bySender,
    pendingTradeCount:   pendingTrades.length,
    challenges:          challengesWithNames,
    profilBadge:         unclaimedMissions + dailyAvail,
    streak: {
      currentStreak: streakRow?.currentStreak ?? 0,
      lastClaimAt:   streakRow?.lastClaimAt ?? null,
    },
  }, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' } })
}
