'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGameStore } from '@/store/game'

export function useAuth() {
  const { user, profile, authStatus, setUser, setProfile, setAuthStatus } = useGameStore(s => ({
    user:       s.user,
    profile:    s.profile,
    authStatus: s.authStatus,
    setUser:    s.setUser,
    setProfile: s.setProfile,
    setAuthStatus: s.setAuthStatus,
  }))

  useEffect(() => {
    const supabase = createClient()
    setAuthStatus('loading')

    async function loadOrCreateProfile(user: { id: string; email?: string; user_metadata?: Record<string, string> }) {
      const { data, error } = await supabase
        .from('player_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setProfile(data)
        // Sync avatar/username Discord à chaque connexion
        const meta = user.user_metadata ?? {}
        const discordName = meta.custom_claims?.global_name ?? meta.full_name ?? meta.name ?? null
        const discordAvatar = meta.avatar_url ?? null
        if (discordName && (data.username !== discordName || data.avatar_url !== discordAvatar)) {
          const { data: updated } = await supabase
            .from('player_profiles')
            .update({ username: discordName, avatar_url: discordAvatar })
            .eq('user_id', user.id)
            .select('*')
            .single()
          if (updated) setProfile(updated)
        }
        return
      }

      if (error?.code === 'PGRST116') {
        // Profil inexistant — on le crée avec les infos Discord
        const meta = user.user_metadata ?? {}
        const username = meta.custom_claims?.global_name ?? meta.full_name ?? meta.name ?? meta.user_name ?? user.email ?? 'Joueur'
        const avatar_url = meta.avatar_url ?? null
        const { data: created } = await supabase
          .from('player_profiles')
          .insert({ user_id: user.id, username, avatar_url })
          .select('*')
          .single()
        if (created) setProfile(created)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email })
        setAuthStatus('authenticated')
        loadOrCreateProfile(session.user as { id: string; email?: string; user_metadata?: Record<string, string> })
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
        loadOrCreateProfile(session.user as { id: string; email?: string; user_metadata?: Record<string, string> })
      } else {
        setUser(null)
        setProfile(null)
        setAuthStatus('unauthenticated')
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line

  return { user, profile, authStatus }
}
