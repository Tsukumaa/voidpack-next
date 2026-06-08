'use client'
import Image from 'next/image'
import { useGameStore } from '@/store/game'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export function StatusBar() {
  const { user, profile, authStatus, pendingCredits } = useGameStore(s => ({
    user:           s.user,
    profile:        s.profile,
    authStatus:     s.authStatus,
    pendingCredits: s.pendingCredits,
  }))

  async function handleAuth() {
    const supabase = createClient()
    if (user) {
      await supabase.auth.signOut()
    } else {
      await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
    }
  }

  const xpPercent = profile
    ? Math.min(100, Math.round((profile.xp % 1000) / 10))
    : 0

  return (
    <header className="sticky top-0 z-50 px-4 pt-3 pb-1">
      <div className="flex items-center justify-between gap-3 max-w-[520px] mx-auto">
        {/* Profil */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-black/60 border border-white/8 backdrop-blur-xl">
          <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-void-cyan to-void-purple flex-shrink-0">
            {profile?.avatar_url && (
              <Image src={profile.avatar_url} alt="" width={28} height={28} className="w-full h-full object-cover" />
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-void-text leading-none">
              {profile?.username ?? 'Joueur'}
            </p>
            <p className="text-[10px] text-void-muted leading-none mt-0.5">
              Niveau {profile?.level ?? 1}
            </p>
          </div>
        </div>

        {/* Streak + Auth */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/60 border border-white/8 backdrop-blur-xl text-xs font-bold">
            <span className="text-void-cyan">◆</span>
            <span>{/* streak */}0j</span>
          </div>
          {authStatus !== 'authenticated' && (
            <button
              onClick={handleAuth}
              className="px-3 py-2 rounded-full bg-void-purple/20 border border-void-purple/40 text-void-purple text-xs font-bold hover:bg-void-purple/35 transition-colors"
            >
              Discord
            </button>
          )}
        </div>
      </div>

      {/* XP Bar */}
      <div className="max-w-[520px] mx-auto mt-2">
        <div className="h-[5px] rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-void-cyan to-void-purple transition-all duration-700 ease-out"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
      </div>
    </header>
  )
}
