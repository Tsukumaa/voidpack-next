'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGameStore } from '@/store/game'

export function useAuth() {
  const { user, profile, authStatus, setUser, setProfile, setAuthStatus } = useGameStore()
  const supabase = createClient()

  useEffect(() => {
    setAuthStatus('loading')

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email })
        setAuthStatus('authenticated')
        // Charger le profil
        supabase
          .from('player_profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single()
          .then(({ data }) => { if (data) setProfile(data) })
      } else {
        setUser(null)
        setProfile(null)
        setAuthStatus('unauthenticated')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email })
        setAuthStatus('authenticated')
      } else {
        setUser(null)
        setProfile(null)
        setAuthStatus('unauthenticated')
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line

  return { user, profile, authStatus, supabase }
}
