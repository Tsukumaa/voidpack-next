'use client'
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useGameStore } from '@/store/game'

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

  useEffect(() => {
    if (status === 'loading') {
      setAuthStatus('loading')
      return
    }

    if (status === 'authenticated' && session?.user) {
      setUser({ id: session.user.id, email: session.user.email ?? undefined })
      setAuthStatus('authenticated')

      // Load profile via API route
      fetch('/api/profile')
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setProfile(data) })
    } else {
      setUser(null)
      setProfile(null)
      setAuthStatus('unauthenticated')
    }
  }, [status, session?.user?.id]) // eslint-disable-line

  return { user, profile, authStatus }
}
