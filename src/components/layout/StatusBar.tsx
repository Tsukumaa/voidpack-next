'use client'
import { Flame, ShoppingBasket, Coins, Shield, LogOut, LogIn } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '@/store/game'
import { signIn, signOut } from 'next-auth/react'
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
    fetch('/api/profile/streak')
      .then(r => r.ok ? r.json() : null)
      .then(data => setStreak(data?.currentStreak ?? 0))
  }, [user?.id]) // eslint-disable-line

  async function handleAuth() {
    if (user) {
      await signOut({ callbackUrl: '/pack' })
    } else {
      await signIn('discord', { callbackUrl: '/pack' })
    }
  }

  const xpPercent = profile ? getLevelProgress(profile.xp ?? 0, profile.level ?? 1) : 0

  return (
    <header className="sticky top-0 z-50 px-4 pt-3 pb-1">
      <div className="flex items-center justify-between gap-3 max-w-[520px] mx-auto">

        {/* Profil + Streak */}
        <div className="relative rounded-full">
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#0a0612] border border-white/[0.06] backdrop-blur-xl">
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
              <span className="text-white/70">{streak ?? 0}j</span>
            </div>
          </div>

          <div className="absolute inset-0 rounded-full pointer-events-none p-[2px]"
            style={{
              background: `conic-gradient(from -90deg, #00c896, #7b2bff ${xpPercent}%, rgba(255,255,255,0.07) ${xpPercent}%)`,
              WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
            }} />
        </div>

        {/* Actions droite */}
        <div className="flex items-center gap-2">

          {/* Admin (réservé aux admins) */}
          {profile?.is_admin && (
            <Link href="/admin" title="Panel Admin"
              className="flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0 transition-all hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #7b2bff, #a855f7)', boxShadow: '0 0 12px rgba(123,43,255,0.45)' }}>
              <Shield size={15} className="text-white" strokeWidth={2.4} />
            </Link>
          )}

          {/* Ko-Fi */}
          <div className="relative group">
            <a href="https://ko-fi.com/voidpack" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#7b2bff]/15 border border-[#7b2bff]/30 hover:bg-[#7b2bff]/25 transition-colors">
              <Coins size={13} className="text-[#a78bfa]" />
              <span className="text-[#a78bfa] text-xs font-bold">Soutenir</span>
            </a>
            <div className="absolute right-0 top-10 w-44 px-3 py-2 rounded-xl bg-[#0f0c1f] border border-white/10 text-white/50 text-[11px] leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-30 text-center">
              Soutenir le projet sur Ko-Fi ☕
            </div>
          </div>

          {/* Boutique */}
          <button onClick={() => setShowShop(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/60 border border-white/[0.08] backdrop-blur-xl hover:bg-white/10 transition-colors">
            <ShoppingBasket size={13} className="text-white/70" />
            <span className="text-white/70 text-xs font-bold">Boutique</span>
          </button>

          {/* Auth */}
          <button onClick={handleAuth}
            className={cn('flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-colors',
              user
                ? 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                : 'bg-[#7b2bff]/20 border border-[#7b2bff]/40 text-[#a78bfa] hover:bg-[#7b2bff]/35'
            )}>
            {user ? <LogOut size={13} /> : <LogIn size={13} />}
            {user ? 'Déconnexion' : 'Discord'}
          </button>
        </div>
      </div>

      {showShop && createPortal(<ShopModal onClose={() => setShowShop(false)} />, document.body)}
    </header>
  )
}
