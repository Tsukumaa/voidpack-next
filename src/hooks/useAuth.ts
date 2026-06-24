'use client'
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useGameStore } from '@/store/game'
import { useSettingsStore } from '@/store/settings'
import { useSocialStore } from '@/store/social'

export function useAuth() {
  const { data: session, status } = useSession()
  const { setUser, setProfile, setAuthStatus } = useGameStore(s => ({
    setUser:       s.setUser,
    setProfile:    s.setProfile,
    setAuthStatus: s.setAuthStatus,
  }))
  const { user, profile, authStatus } = useGameStore(s => ({
    user:       s.user,
    profile:    s.profile,
    authStatus: s.authStatus,
  }))
  const syncFromProfile = useSettingsStore(s => s.syncFromProfile)
  const addToast = useSocialStore(s => s.addToast)

  useEffect(() => {
    if (status === 'loading') {
      setAuthStatus('loading')
      return
    }

    if (status === 'authenticated' && session?.user) {
      setUser({ id: session.user.id, email: session.user.email ?? undefined })
      setAuthStatus('authenticated')

      fetch('/api/profile')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setProfile(data)
            syncFromProfile(data.music_volume ?? null, data.music_muted ?? null)
            if (data.welcome_booster) {
              addToast({
                type: 'info',
                title: 'Bienvenue sur VOID Pack !',
                body: 'Un VOID Pack t\'attend, ouvre-le dans la page Pack.',
                action: { label: 'Ouvrir', href: '/pack' },
              })
            }
          }
        })
    } else {
      setUser(null)
      setProfile(null)
      setAuthStatus('unauthenticated')
    }
  }, [status, session?.user?.id]) // eslint-disable-line

  return { user, profile, authStatus }
}
