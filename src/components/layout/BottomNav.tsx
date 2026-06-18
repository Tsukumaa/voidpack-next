'use client'
import React from 'react'
import { PackageOpen, Library, Users, User } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useSocialStore } from '@/store/social'
import { useGameStore } from '@/store/game'

export function BottomNav() {
  const pathname           = usePathname()
  const user               = useGameStore(s => s.user)
  const pendingFriendCount = useSocialStore(s => s.pendingFriendCount)
  const pendingTradeCount  = useSocialStore(s => s.pendingTradeCount)
  const communauteBadge    = user ? pendingFriendCount + pendingTradeCount : 0

  const TABS = [
    { href: '/pack',       label: 'Pack',      icon: <PackageOpen size={20} />, badge: 0 },
    { href: '/collection', label: 'Cartes',    icon: <Library size={20} />,     badge: 0 },
    { href: '/communaute', label: 'Communauté',icon: <Users size={20} />,       badge: communauteBadge },
    { href: '/profil',     label: 'Profil',    icon: <User size={20} />,        badge: 0 },
  ]

  return (
    <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-24px)] max-w-[520px]">
      <div className="grid grid-cols-4 gap-2 p-2.5 rounded-[26px] bg-[rgba(8,10,18,0.82)] backdrop-blur-2xl shadow-[0_16px_50px_rgba(0,0,0,0.6)]">
        {TABS.map(tab => {
          const isActive = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 min-h-[54px] rounded-[18px] transition-all',
                isActive
                  ? 'bg-white/7 text-white shadow-[inset_0_0_22px_rgba(123,43,255,0.12)]'
                  : 'text-white/45 hover:text-white/70'
              )}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#ff4757] text-white text-[9px] font-bold flex items-center justify-center">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
