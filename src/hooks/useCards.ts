import { useCallback } from 'react'
import { useGameStore } from '@/store/game'

// Court : /api/cards répond 304 (vide) quand rien n'a changé, donc revalider souvent coûte peu
// et une carte masquée par l'admin disparaît presque immédiatement
const CACHE_TTL = 30 * 1000

export function useCards() {
  const { cardsCache, cardsCachedAt, setCardsCache } = useGameStore(s => ({
    cardsCache: s.cardsCache,
    cardsCachedAt: s.cardsCachedAt,
    setCardsCache: s.setCardsCache,
  }))

  const fetchCards = useCallback(async () => {
    const isFresh = cardsCachedAt && Date.now() - cardsCachedAt < CACHE_TTL
    if (isFresh && cardsCache) return cardsCache

    const data = await fetch('/api/cards').then(r => r.ok ? r.json() : [])
    setCardsCache(data)
    return data
  }, [cardsCache, cardsCachedAt, setCardsCache])

  return { fetchCards, cardsCache }
}
