'use client'
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
import { useGameStore } from '@/store/game'
import { useBoosterCredits } from '@/hooks/useBoosterCredits'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { BoosterOpening } from './BoosterOpening'
import type { BoosterCredit } from '@/types/player'

interface CardResult {
  id: string
  name: string
  rarity: string
  family?: string
  artUrl?: string
}

// Regroupe les crédits par type → { void: [credit1, credit2], nebulor: [credit3] }
function groupCredits(credits: BoosterCredit[]) {
  const map: Record<string, BoosterCredit[]> = {}
  for (const c of credits) {
    const t = c.booster_type ?? 'void'
    if (!map[t]) map[t] = []
    map[t].push(c)
  }
  return map
}

export function PackScreen() {
  const { user, profile }   = useGameStore(s => ({ user: s.user, profile: s.profile }))
  const { pendingCredits, loadCredits, removePendingCredit } = useBoosterCredits()

  const [loading, setLoading]             = useState(false)
  const [hint, setHint]                   = useState('')
  const [openedCards, setOpenedCards]     = useState<CardResult[] | null>(null)
  const [boosterImages, setBoosterImages] = useState<Record<string, string>>({})
  const [carouselIdx, setCarouselIdx]     = useState(0)
  const touchStartX = useRef<number | null>(null)

  // Groupes de boosters disponibles
  const groups = useMemo(() => groupCredits(pendingCredits), [pendingCredits])
  const types  = useMemo(() => Object.keys(groups), [groups])

  // Index sécurisé
  const safeIdx = Math.min(carouselIdx, Math.max(0, types.length - 1))
  const activeType = types[safeIdx] ?? null
  const activeCredits = activeType ? groups[activeType] : []
  const activeCount = activeCredits.length

  // Charger les images depuis settings
  useEffect(() => {
    if (!types.length) return
    const sb = createClient()
    const keys = ['void', ...types].map(t => `booster_image_${t}`)
    sb.from('settings').select('key,value').in('key', keys).then(({ data }) => {
      const map: Record<string, string> = {}
      for (const row of data ?? []) {
        const type = row.key.replace('booster_image_', '')
        map[type] = row.value
      }
      setBoosterImages(map)
    })
  }, [types.join(',')])  // eslint-disable-line

  // Hint
  useEffect(() => {
    if (!user) { setHint('Connecte-toi avec Discord pour ouvrir un booster.'); return }
    const total = pendingCredits.length
    if (total === 0) { setHint('Aucun booster disponible.'); return }
    setHint(total === 1 ? "1 booster disponible !" : `${total} boosters disponibles !`)
  }, [user, pendingCredits.length])

  // Swipe handlers
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) {
      if (dx < 0) setCarouselIdx(i => Math.min(i + 1, types.length - 1))
      else        setCarouselIdx(i => Math.max(i - 1, 0))
    }
    touchStartX.current = null
  }

  const handleOpen = useCallback(async () => {
    if (loading || !user || !activeType || !activeCredits.length) return
    const credit = activeCredits[0]
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: claimErr } = await supabase.rpc('claim_booster_credit', { p_id: credit.id })
      if (claimErr) throw claimErr
      removePendingCredit(credit.id)

      const res = await fetch('/api/booster/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booster_type: activeType, count: 5 }),
      })
      if (!res.ok) throw new Error('Erreur génération pack')
      const { cards } = await res.json()
      setOpenedCards(cards as CardResult[])
    } catch (e) {
      console.error(e)
      setHint("Erreur lors de l'ouverture.")
    } finally {
      setLoading(false)
    }
  }, [loading, user, activeType, activeCredits, removePendingCredit])

  const stats = [
    { label: 'Collection', value: `${profile?.packs_opened ?? 0} cartes` },
    { label: 'Rareté max',  value: profile?.highest_rarity ?? '—' },
    { label: 'Packs',       value: String(profile?.packs_opened ?? '—') },
  ]

  const imgFor = (type: string) => boosterImages[type] || '/assets/dos.png'

  return (
    <>
      {openedCards && activeType && (
        <BoosterOpening
          cards={openedCards}
          boosterImageUrl={imgFor(activeType)}
          onClose={() => { setOpenedCards(null); loadCredits() }}
        />
      )}

      <div className="flex flex-col items-center gap-4 pt-4 w-full">

        {/* ── Carrousel ── */}
        {types.length > 0 ? (
          <div
            className="w-full flex flex-col items-center gap-4"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {/* Pack actif */}
            <div className="relative flex items-center justify-center">

              {/* Flèche gauche */}
              {types.length > 1 && safeIdx > 0 && (
                <button
                  onClick={() => setCarouselIdx(i => i - 1)}
                  className="absolute left-0 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 transition-all"
                  style={{ transform: 'translateX(-48px)' }}
                >‹</button>
              )}

              {/* Pack avec badge */}
              <button
                onClick={handleOpen}
                disabled={loading}
                className={cn('relative flex flex-col items-center', loading && 'opacity-60 pointer-events-none')}
              >
                {/* Badge quantité */}
                <div className="absolute -top-3 -right-3 z-10 min-w-[28px] h-7 px-2 rounded-full bg-[#7b2bff] border-2 border-black flex items-center justify-center text-xs font-black text-white shadow-lg">
                  ×{activeCount}
                </div>

                {/* Image du pack — libre, drop-shadow suit le contour */}
                <div
                  style={{
                    width: 'min(72vw, 280px)',
                    filter: `drop-shadow(0 0 28px ${activeCount > 0 ? 'rgba(123,43,255,0.7)' : 'rgba(123,43,255,0.3)'}) drop-shadow(0 0 60px rgba(123,43,255,0.25))`,
                    animation: 'boosterFloat 3s ease-in-out infinite',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgFor(activeType)}
                    alt={activeType}
                    className="w-full h-auto block"
                    draggable={false}
                  />
                </div>

                {/* Nom du type + spinner */}
                <div className="mt-3 flex items-center gap-2">
                  {loading && (
                    <div className="w-4 h-4 border-2 border-[#7b2bff]/30 border-t-[#7b2bff] rounded-full animate-spin" />
                  )}
                  <span className="text-white/70 text-sm font-semibold capitalize">
                    {activeType === 'void' ? 'VOID Pack' : `${activeType} Pack`}
                  </span>
                </div>
              </button>

              {/* Flèche droite */}
              {types.length > 1 && safeIdx < types.length - 1 && (
                <button
                  onClick={() => setCarouselIdx(i => i + 1)}
                  className="absolute right-0 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 transition-all"
                  style={{ transform: 'translateX(48px)' }}
                >›</button>
              )}
            </div>

            {/* Indicateurs de pagination */}
            {types.length > 1 && (
              <div className="flex gap-2">
                {types.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCarouselIdx(i)}
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: i === safeIdx ? '20px' : '8px',
                      height: '8px',
                      background: i === safeIdx ? '#7b2bff' : 'rgba(255,255,255,0.2)',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Pas de booster — pack inactif */
          <div
            style={{
              width: 'min(72vw, 280px)',
              filter: 'drop-shadow(0 0 20px rgba(107,33,212,0.3))',
              animation: 'boosterFloat 3s ease-in-out infinite',
              opacity: 0.5,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/dos.png" alt="Booster" className="w-full h-auto block" draggable={false} />
          </div>
        )}

        {/* Hint */}
        <p className={cn(
          'text-xs text-center transition-colors',
          pendingCredits.length > 0 ? 'text-[#00c896]' : 'text-white/40'
        )}>
          {hint}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2.5 w-full mt-1">
          {stats.map(s => (
            <div key={s.label} className="rounded-[18px] bg-[rgba(12,14,22,0.62)] border border-white/[0.08] backdrop-blur-md p-3">
              <span className="block text-[10px] uppercase tracking-widest text-white/50 font-bold">{s.label}</span>
              <strong className="block mt-1.5 text-sm text-white">{s.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
