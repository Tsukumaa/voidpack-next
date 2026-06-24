import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsStore {
  musicVolume: number
  musicMuted: boolean
  setMusicVolume: (v: number) => void
  setMusicMuted: (m: boolean) => void
  syncFromProfile: (volume: number | null, muted: boolean | null) => void
}

function saveToDb(patch: { musicVolume?: number; musicMuted?: boolean }) {
  fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).catch(() => {})
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      musicVolume: 0.10,
      musicMuted:  false,
      setMusicVolume: (v) => { set({ musicVolume: v }); saveToDb({ musicVolume: v }) },
      setMusicMuted:  (m) => { set({ musicMuted: m });  saveToDb({ musicMuted: m }) },
      syncFromProfile: (volume, muted) => {
        const patch: Partial<{ musicVolume: number; musicMuted: boolean }> = {}
        if (volume !== null) patch.musicVolume = volume
        if (muted  !== null) patch.musicMuted  = muted
        if (Object.keys(patch).length) set(patch)
      },
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
