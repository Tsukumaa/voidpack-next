import { create } from 'zustand'
import type { PlayerProfile, BoosterCredit } from '@/types/player'

interface GameStore {
  // Auth
  user: { id: string; email?: string } | null
  profile: PlayerProfile | null
  authStatus: 'idle' | 'loading' | 'authenticated' | 'unauthenticated'

  // Boosters
  pendingCredits: BoosterCredit[]
  creditsFetchedAt: number | null
  creditsLoading: boolean

  // Cards cache (partagé entre toutes les pages, fetché une seule fois par session)
  cardsCache: unknown[] | null
  cardsCachedAt: number | null

  // Actions
  setUser:           (user: GameStore['user']) => void
  setProfile:        (profile: PlayerProfile | null) => void
  setAuthStatus:     (status: GameStore['authStatus']) => void
  setPendingCredits: (credits: BoosterCredit[]) => void
  removePendingCredit: (id: number) => void
  setCreditsLoading: (loading: boolean) => void
  setCardsCache:     (cards: unknown[]) => void
}

export const useGameStore = create<GameStore>((set) => ({
  user:           null,
  profile:        null,
  authStatus:     'idle',
  pendingCredits:   [],
  creditsFetchedAt: null,
  creditsLoading:   false,
  cardsCache:       null,
  cardsCachedAt:    null,

  setUser:           (user)    => set({ user }),
  setProfile:        (profile) => set({ profile }),
  setAuthStatus:     (status)  => set({ authStatus: status }),
  setPendingCredits: (credits) => set({ pendingCredits: credits, creditsFetchedAt: Date.now() }),
  removePendingCredit: (id)    => set(s => ({
    pendingCredits: s.pendingCredits.filter(c => String(c.id) !== String(id)),
  })),
  setCreditsLoading: (loading) => set({ creditsLoading: loading }),
  setCardsCache: (cards) => set({ cardsCache: cards, cardsCachedAt: Date.now() }),
}))
