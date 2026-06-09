'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/pack',        label: 'Pack',        icon: '◈' },
  { href: '/collection',  label: 'Cartes',       icon: '▣' },
  { href: '/communaute',  label: 'Communauté',   icon: '⬡' },
  { href: '/profil',      label: 'Profil',       icon: '●' },
]

export function BottomNav() {
  const pathname = usePathname()

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
                'flex flex-col items-center justify-center gap-0.5 min-h-[54px] rounded-[18px] transition-all',
                isActive
                  ? 'bg-white/7 text-white shadow-[inset_0_0_22px_rgba(123,43,255,0.12)]'
                  : 'text-white/45 hover:text-white/70'
              )}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className="text-[11px] font-semibold">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
