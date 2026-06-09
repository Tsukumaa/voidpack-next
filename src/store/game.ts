import { create } from 'zustand'
import type { PlayerProfile, BoosterCredit } from '@/types/player'

interface GameStore {
  // Auth
  user: { id: string; email?: string } | null
  profile: PlayerProfile | null
  authStatus: 'idle' | 'loading' | 'authenticated' | 'unauthenticated'

  // Boosters
  pendingCredits: BoosterCredit[]

  // Actions
  setUser:           (user: GameStore['user']) => void
  setProfile:        (profile: PlayerProfile | null) => void
  setAuthStatus:     (status: GameStore['authStatus']) => void
  setPendingCredits: (credits: BoosterCredit[]) => void
  removePendingCredit: (id: number) => void
}

export const useGameStore = create<GameStore>((set) => ({
  user:           null,
  profile:        null,
  authStatus:     'idle',
  pendingCredits: [],

  setUser:           (user)    => set({ user }),
  setProfile:        (profile) => set({ profile }),
  setAuthStatus:     (status)  => set({ authStatus: status }),
  setPendingCredits: (credits) => set({ pendingCredits: credits }),
  removePendingCredit: (id)    => set(s => ({
    pendingCredits: s.pendingCredits.filter(c => String(c.id) !== String(id)),
  })),
}))
