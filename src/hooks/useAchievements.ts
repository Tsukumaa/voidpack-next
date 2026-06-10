import { createClient } from '@/lib/supabase/client'
import { useGameStore } from '@/store/game'

interface Card { rarity: string; id: string }

export function useAchievements() {
  const { profile } = useGameStore(s => ({ profile: s.profile }))
  const sb = createClient()

  async function checkAfterPackOpen(cards: Card[], totalPacks: number, uniqueCards: number) {
    const rarities = cards.map(c => c.rarity)
    const promises: Promise<unknown>[] = []

    const unlock = (id: string) => promises.push(sb.rpc('unlock_achievement', { p_achievement_id: id }))
    const progress = (id: string, n = 1) => promises.push(sb.rpc('progress_mission', { p_mission_id: id, p_amount: n }))

    // ── Succès boosters ──
    if (totalPacks >= 1)   unlock('open_first')
    if (totalPacks >= 10)  unlock('open_10')
    if (totalPacks >= 50)  unlock('open_50')
    if (totalPacks >= 100) unlock('open_100')

    // ── Succès raretés ──
    if (rarities.includes('rare') || rarities.includes('epic') || rarities.includes('legendary') || rarities.includes('void'))
      unlock('get_rare')
    if (rarities.includes('epic') || rarities.includes('legendary') || rarities.includes('void'))
      unlock('get_epic')
    if (rarities.includes('legendary') || rarities.includes('void'))
      unlock('get_legendary')
    if (rarities.includes('void'))
      unlock('get_void')

    // ── Succès collection ──
    if (uniqueCards >= 10)  unlock('cards_10')
    if (uniqueCards >= 25)  unlock('cards_25')
    if (uniqueCards >= 50)  unlock('cards_50')
    if (uniqueCards >= 100) unlock('cards_100')

    // ── Succès niveau ──
    const level = profile?.level ?? 1
    if (level >= 5)  unlock('level_5')
    if (level >= 10) unlock('level_10')
    if (level >= 25) unlock('level_25')
    if (level >= 50) unlock('level_50')

    // ── Missions quotidiennes ──
    progress('open_1_pack', 1)
    progress('open_3_packs', 1)
    progress('collect_5', cards.length)

    if (rarities.includes('rare') || rarities.includes('epic') || rarities.includes('legendary') || rarities.includes('void'))
      progress('get_rare', 1)
    if (rarities.includes('epic') || rarities.includes('legendary') || rarities.includes('void'))
      progress('get_epic', 1)

    // Mission daily login (si pas encore faite)
    progress('daily_login', 1)

    await Promise.allSettled(promises)
  }

  return { checkAfterPackOpen }
}
