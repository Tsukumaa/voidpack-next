'use client'
import Image from 'next/image'
import { useGameStore } from '@/store/game'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export function StatusBar() {
  const { user, profile, authStatus } = useGameStore(s => ({
    user:       s.user,
    profile:    s.profile,
    authStatus: s.authStatus,
  }))

  async function handleAuth() {
    const supabase = createClient()
    if (user) {
      await supabase.auth.signOut()
    } else {
      await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
    }
  }

  // Calcul XP
  const xpPercent = profile
    ? (() => {
        const xpForLevel = (lvl: number) => Math.floor(100 * Math.pow(lvl, 1.5))
        const currentLvlXp = xpForLevel(profile.level - 1)
        const nextLvlXp    = xpForLevel(profile.level)
        const range = nextLvlXp - currentLvlXp
        const inRange = (profile.xp || 0) - currentLvlXp
        return Math.min(100, Math.max(0, Math.round((inRange / range) * 100)))
      })()
    : 0

  return (
    <header className="sticky top-0 z-50 px-4 pt-3 pb-1">
      <div className="flex items-center justify-between gap-3 max-w-[520px] mx-auto">
        {/* Profil */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-black/60 border border-white/[0.08] backdrop-blur-xl">
          <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-[#00c896] to-[#7b2bff] flex-shrink-0 flex items-center justify-center">
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url} alt="" width={28} height={28} className="w-full h-full object-cover" unoptimized />
            ) : (
              <span className="text-[10px] font-bold text-white">
                {profile?.username?.[0]?.toUpperCase() ?? '?'}
              </span>
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-white leading-none">
              {profile?.username ?? 'Joueur'}
            </p>
            <p className="text-[10px] text-white/50 leading-none mt-0.5">
              Niveau {profile?.level ?? 1}
            </p>
          </div>
        </div>

        {/* Streak + Auth */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/60 border border-white/[0.08] backdrop-blur-xl text-xs font-bold">
            <span className="text-[#00c896]">◆</span>
            <span>0j</span>
          </div>
          <button
            onClick={handleAuth}
            className={cn(
              'px-3 py-2 rounded-full text-xs font-bold transition-colors',
              user
                ? 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                : 'bg-[#7b2bff]/20 border border-[#7b2bff]/40 text-[#a78bfa] hover:bg-[#7b2bff]/35'
            )}
          >
            {user ? 'Déconnexion' : 'Discord'}
          </button>
        </div>
      </div>

      {/* XP Bar */}
      <div className="max-w-[520px] mx-auto mt-2">
        <div className="h-[5px] rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#00c896] to-[#7b2bff] transition-all duration-700 ease-out"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
      </div>
    </header>
  )
}
