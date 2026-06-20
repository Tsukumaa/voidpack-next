import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsStore {
  musicVolume: number
  musicMuted: boolean
  setMusicVolume: (v: number) => void
  setMusicMuted: (m: boolean) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      musicVolume: 0.10,
      musicMuted:  false,
      setMusicVolume: (v) => set({ musicVolume: v }),
      setMusicMuted:  (m) => set({ musicMuted: m }),
    }),
    {
      name: 'voidpack-settings',
      version: 3,
      migrate: (state, version) => {
        if (version < 3) return { musicVolume: 0.10, musicMuted: false }
        return state as { musicVolume: number; musicMuted: boolean }
      },
    }
  )
)
