'use client'

import {
  Flame,
  ShoppingBasket,
  Coins,
  Shield,
  LogOut,
  LogIn,
} from 'lucide-react'
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

  for (let i = 1; i < level; i++) {
    cumulative += xpForLevel(i)
  }

  const needed = xpForLevel(level)
  const inLevel = xp - cumulative

  return Math.min(
    100,
    Math.max(0, Math.round((inLevel / needed) * 100))
  )
}

export function StatusBar() {
  const { user, profile } = useGameStore((s) => ({
    user: s.user,
    profile: s.profile,
  }))

  const [streak, setStreak] = useState<number | null>(null)
  const [showShop, setShowShop] = useState(false)

  useEffect(() => {
    if (!user) return

    fetch('/api/profile/streak')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setStreak(data?.currentStreak ?? 0))
  }, [user?.id])

  async function handleAuth() {
    if (user) {
      await signOut({ callbackUrl: '/pack' })
    } else {
      await signIn('discord', { callbackUrl: '/pack' })
    }
  }

  const xpPercent = profile
    ? getLevelProgress(profile.xp ?? 0, profile.level ?? 1)
    : 0

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 pb-2">

      <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">

        {/* Profil */}
        <div className="relative min-w-0">

          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#0a0612] border border-white/[0.06] backdrop-blur-xl min-w-0">

            <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#00c896] to-[#7b2bff] flex items-center justify-center flex-shrink-0">

              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt=""
                  width={32}
                  height={32}
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-[10px] font-bold">
                  {profile?.username?.[0]?.toUpperCase() ?? '?'}
                </span>
              )}

            </div>

            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate max-w-[120px]">
                {profile?.username ?? 'Joueur'}
              </p>

              <p className="text-[10px] text-white/50">
                Niveau {profile?.level ?? 1}
              </p>
            </div>

            <div className="w-px h-4 bg-white/10 hidden xs:block" />

            <div className="flex items-center gap-1 text-xs font-bold shrink-0">
              <Flame size={13} className="text-[#ff9a3d]" />
              <span className="text-white/70">
                {streak ?? 0}j
              </span>
            </div>

          </div>

          <div
            className="absolute inset-0 rounded-full pointer-events-none p-[2px]"
            style={{
              background: `conic-gradient(
                from -90deg,
                #00c896,
                #7b2bff ${xpPercent}%,
                rgba(255,255,255,.07) ${xpPercent}%
              )`,
              WebkitMask:
                'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
            }}
          />

        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">

          {profile?.is_admin && (
            <Link
              href="/admin"
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{
                background:
                  'linear-gradient(135deg,#7b2bff,#a855f7)',
              }}
            >
              <Shield size={15} />
            </Link>
          )}

          <a
            href="https://ko-fi.com/voidpack"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-3 py-2 rounded-full bg-[#7b2bff]/15 border border-[#7b2bff]/30"
          >
            <Coins size={13} />

            <span className="hidden sm:inline text-xs font-bold">
              Soutenir
            </span>
          </a>

          <button
            onClick={() => setShowShop(true)}
            className="flex items-center gap-1 px-3 py-2 rounded-full bg-black/60 border border-white/[0.08]"
          >
            <ShoppingBasket size={13} />

            <span className="hidden sm:inline text-xs">
              Boutique
            </span>
          </button>

          <button
            onClick={handleAuth}
            className={cn(
              'flex items-center gap-1 px-3 py-2 rounded-full text-xs font-bold',
              user
                ? 'bg-white/5 border border-white/10'
                : 'bg-[#7b2bff]/20 border border-[#7b2bff]/40'
            )}
          >
            {user ? <LogOut size={13} /> : <LogIn size={13} />}

            <span className="hidden sm:inline">
              {user
                ? 'Déconnexion'
                : 'Discord'}
            </span>
          </button>

        </div>

      </div>

      {showShop &&
        createPortal(
          <ShopModal onClose={() => setShowShop(false)} />,
          document.body
        )}
    </header>
  )
}
