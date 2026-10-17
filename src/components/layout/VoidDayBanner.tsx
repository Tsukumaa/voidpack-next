'use client'
import { useEffect, useState } from 'react'
import { useFeatures } from '@/hooks/useFeatures'
import { cn } from '@/lib/utils'

// Bandeau affiché sur tout le site pendant le Void Day (réglage admin `event_void_day`).
// Placé dans le header sticky : complet en haut de page, réduit en badge compact pendant le scroll.
export function VoidDayBanner() {
  const { features } = useFeatures()
  const active = features.event_void_day === true
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (!active) return
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [active])

  if (!active) return null

  return (
    <div className="flex justify-center mt-2">
      <div className="flex items-center justify-center gap-2 rounded-xl font-bold text-center text-[#f3e8ff] transition-all duration-300"
        style={{
          // Fond opaque : le contenu qui défile dessous ne doit pas transparaître
          background: 'linear-gradient(90deg, #2a1259, #1e0d40, #2a1259)',
          border: '1px solid rgba(168,85,247,0.45)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.6), 0 0 16px rgba(123,43,255,0.3)',
          padding: scrolled ? '4px 10px' : '6px 12px',
          maxWidth: scrolled ? 360 : 672,
          width: '100%',
        }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/branding/void-favicon.png" alt="" aria-hidden="true"
          className={scrolled ? 'w-3.5 h-3.5 shrink-0' : 'w-4 h-4 shrink-0'}
          style={{ filter: 'drop-shadow(0 0 6px rgba(168,85,247,0.8))' }} />
        <span className={cn('whitespace-nowrap', scrolled ? 'text-[10px] sm:text-[11px]' : 'text-[10px] sm:text-xs')}>
          <span className="font-black tracking-wide">VOID DAY</span>
          {/* Version courte sur mobile et pendant le scroll : toujours sur une seule ligne */}
          <span className={cn('text-white/70 font-semibold', !scrolled && 'sm:hidden')}> · 1 acheté = 1 offert</span>
          {!scrolled && (
            <span className="hidden sm:inline text-white/70 font-semibold"> · 1 booster acheté = 1 offert (Compatible achats Mana et Twitch)</span>
          )}
        </span>
      </div>
    </div>
  )
}
