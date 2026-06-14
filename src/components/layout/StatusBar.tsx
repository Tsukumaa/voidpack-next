'use client'
import { Flame, Gift, Coffee } from 'lucide-react'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useGameStore } from '@/store/game'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ShopModal } from '@/components/game/ShopModal'

function xpForLevel(lvl: number) {
  return Math.floor(200 * Math.pow(1.18, lvl - 1))
}

function getLevelProgress(xp: number, level: number) {
  let cumulative = 0
  for (let i = 1; i < level; i++) cumulative += xpForLevel(i)
  const needed = xpForLevel(level)
  const inLevel = xp - cumulative
  return Math.min(100, Math.max(0, Math.round((inLevel / needed) * 100)))
}

export function StatusBar() {
  const { user, profile, authStatus } = useGameStore(s => ({
    user: s.user, profile: s.profile, authStatus: s.authStatus,
  }))
  const [streak, setStreak] = useState<number | null>(null)
  const [showShop, setShowShop] = useState(false)

  useEffect(() => {
    if (!user) return
    createClient()
      .from('player_daily_rewards')
      .select('current_streak')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => setStreak(data?.current_streak ?? 0))
  }, [user?.id]) // eslint-disable-line

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

  const xpPercent = profile ? getLevelProgress(profile.xp ?? 0, profile.level ?? 1) : 0

  return (
    <header className="sticky top-0 z-50 px-4 pt-3 pb-1">
      <div className="flex items-center justify-between gap-3 max-w-[520px] mx-auto">

        {/* Profil + Streak */}
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
            <p className="text-xs font-bold text-white leading-none">{profile?.username ?? 'Joueur'}</p>
            <p className="text-[10px] text-white/50 leading-none mt-0.5">Niveau {profile?.level ?? 1}</p>
          </div>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <div className="flex items-center gap-1 text-xs font-bold">
            <Flame size={13} className="text-[#ff9a3d]" />
            <span className="text-white/70">{streak ?? profile?.current_streak ?? 0}j</span>
          </div>
        </div>

        {/* Actions droite */}
        <div className="flex items-center gap-2">

          {/* Ko-Fi */}
          <div className="relative group">
            <a href="https://ko-fi.com/voidpack" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#7b2bff]/15 border border-[#7b2bff]/30 hover:bg-[#7b2bff]/25 transition-colors">
              <Coffee size={13} className="text-[#a78bfa]" />
              <span className="text-[#a78bfa] text-xs font-bold">Soutenir</span>
            </a>
            <div className="absolute right-0 top-10 w-44 px-3 py-2 rounded-xl bg-[#0f0c1f] border border-white/10 text-white/50 text-[11px] leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-30 text-center">
              Soutenir le projet sur Ko-Fi ☕
            </div>
          </div>

          {/* Boutique */}
          <button onClick={() => setShowShop(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/60 border border-white/[0.08] backdrop-blur-xl hover:bg-white/10 transition-colors">
            <Gift size={13} className="text-white/70" />
            <span className="text-white/70 text-xs font-bold">Boutique</span>
          </button>

          {/* Auth */}
          <button onClick={handleAuth}
            className={cn('px-3 py-2 rounded-full text-xs font-bold transition-colors',
              user
                ? 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                : 'bg-[#7b2bff]/20 border border-[#7b2bff]/40 text-[#a78bfa] hover:bg-[#7b2bff]/35'
            )}>
            {user ? 'Déconnexion' : 'Discord'}
          </button>
        </div>
      </div>

      {/* XP Bar */}
      <div className="max-w-[520px] mx-auto mt-2">
        <div className="h-[5px] rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[#00c896] to-[#7b2bff] transition-all duration-700 ease-out"
            style={{ width: `${xpPercent}%` }} />
        </div>
      </div>

      {showShop && <ShopModal onClose={() => setShowShop(false)} />}
    </header>
  )
}
