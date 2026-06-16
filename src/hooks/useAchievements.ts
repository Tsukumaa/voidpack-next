import { useGameStore } from '@/store/game'

interface Card { rarity: string; id: string }

export function useAchievements() {
  const { profile } = useGameStore(s => ({ profile: s.profile }))

  async function checkAfterPackOpen(cards: Card[], totalPacks: number, uniqueCards: number, boosterType = 'void') {
    const rarities = cards.map(c => c.rarity)

    await fetch('/api/achievements/check', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ rarities, totalPacks, uniqueCards, boosterType, level: profile?.level ?? 1 }),
    })
  }

  return { checkAfterPackOpen }
}
