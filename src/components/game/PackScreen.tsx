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
  const { user, profile } = useGameStore(s => ({ user: s.user, profile: s.profile }))
  const { pendingCredits, loadCredits, removePendingCredit } = useBoosterCredits()

  const [loading, setLoading]             = useState(false)
  const [openedCards, setOpenedCards]     = useState<CardResult[] | null>(null)
  const [openedType, setOpenedType]       = useState<string>('void')
  const [openedImageUrl, setOpenedImageUrl] = useState<string>('/assets/dos.png')
  const [boosterImages, setBoosterImages] = useState<Record<string, string>>({})
  const [carouselIdx, setCarouselIdx]     = useState(0)
  const touchStartX = useRef<number | null>(null)

  const groups   = useMemo(() => groupCredits(pendingCredits), [pendingCredits])
  const types    = useMemo(() => Object.keys(groups), [groups])
  const safeIdx  = Math.min(carouselIdx, Math.max(0, types.length - 1))
  const activeType    = types[safeIdx] ?? null
  const activeCredits = activeType ? groups[activeType] : []
  const activeCount   = activeCredits.length
  const hasCredits    = pendingCredits.length > 0

  useEffect(() => {
    if (!types.length) return
    const sb   = createClient()
    const keys = types.map(t => `booster_image_${t}`)
    sb.from('settings').select('key,value').in('key', keys).then(({ data }) => {
      const map: Record<string, string> = {}
      for (const row of data ?? []) map[row.key.replace('booster_image_', '')] = row.value
      setBoosterImages(map)
    })
  }, [types.join(',')]) // eslint-disable-line

  // Ref pour éviter le bug de closure sur activeType/activeCredits
  const activeTypeRef    = useRef(activeType)
  const activeCreditsRef = useRef(activeCredits)
  useEffect(() => { activeTypeRef.current    = activeType    }, [activeType])
  useEffect(() => { activeCreditsRef.current = activeCredits }, [activeCredits])

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
    const type    = activeTypeRef.current
    const credits = activeCreditsRef.current
    if (loading || !user || !type || !credits.length) return
    const credit = credits[0]
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: claimErr } = await supabase.rpc('claim_booster_credit', { p_id: credit.id })
      if (claimErr) throw claimErr

      const res = await fetch('/api/booster/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booster_type: type, count: 5 }),
      })
      if (!res.ok) throw new Error('Erreur génération pack')
      const { cards } = await res.json()

      const imageUrl = boosterImages[type] || '/assets/dos.png'

      // Afficher les cartes AVANT de retirer le crédit du state
      setOpenedType(type)
      setOpenedImageUrl(imageUrl)
      setOpenedCards(cards as CardResult[])

      removePendingCredit(credit.id)
    } catch (e) {
      console.error(e)
      loadCredits()
    } finally {
      setLoading(false)
    }
  }, [loading, user, removePendingCredit, loadCredits, boosterImages])

  const imgFor = (type: string) => boosterImages[type] || '/assets/dos.png'

  return (
    <>
      {openedCards && (
        <BoosterOpening
          cards={openedCards}
          boosterImageUrl={openedImageUrl}
          onClose={() => { setOpenedCards(null); loadCredits() }}
        />
      )}

      {/* Centrage vertical plein écran (sous statusbar, au-dessus navbar) */}
      <div className="relative flex flex-col items-center justify-center gap-6 w-full" style={{ height: 'calc(100svh - 120px)' }}>

        {hasCredits ? (
          /* ── Carrousel boosters ── */
          <div
            className="flex flex-col items-center gap-4 w-full"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div className="relative flex items-center justify-center w-full">

              {/* Flèche gauche */}
              {types.length > 1 && safeIdx > 0 && (
                <button
                  onClick={() => setCarouselIdx(i => i - 1)}
                  className="absolute left-4 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 transition-all text-xl"
                >‹</button>
              )}

              {/* Pack */}
              <button
                onClick={handleOpen}
                disabled={loading}
                className={cn('relative flex flex-col items-center', loading && 'opacity-60 pointer-events-none')}
              >
                {/* Badge quantité */}
                <div className="absolute -top-3 -right-3 z-10 min-w-[28px] h-7 px-2 rounded-full bg-[#7b2bff] border-2 border-black flex items-center justify-center text-xs font-black text-white shadow-lg">
                  ×{activeCount}
                </div>

                <div style={{
                  width: 'min(72vw, 280px)',
                  filter: 'drop-shadow(0 0 35px rgba(123,43,255,0.65)) drop-shadow(0 0 70px rgba(123,43,255,0.25))',
                  animation: 'boosterFloat 3s ease-in-out infinite',
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgFor(activeType)} alt={activeType} className="w-full h-auto block" draggable={false} />
                </div>

                <div className="mt-3 flex items-center gap-2 h-5">
                  {loading
                    ? <div className="w-4 h-4 border-2 border-[#7b2bff]/30 border-t-[#7b2bff] rounded-full animate-spin" />
                    : <span className="text-white/60 text-sm font-semibold capitalize">
                        {activeType === 'void' ? 'VOID Pack' : `${activeType} Pack`}
                      </span>
                  }
                </div>
              </button>

              {/* Flèche droite */}
              {types.length > 1 && safeIdx < types.length - 1 && (
                <button
                  onClick={() => setCarouselIdx(i => i + 1)}
                  className="absolute right-4 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 transition-all text-xl"
                >›</button>
              )}
            </div>

            {/* Indicateurs pagination */}
            {types.length > 1 && (
              <div className="flex gap-2">
                {types.map((_, i) => (
                  <button key={i} onClick={() => setCarouselIdx(i)}
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: i === safeIdx ? '20px' : '8px', height: '8px',
                      background: i === safeIdx ? '#7b2bff' : 'rgba(255,255,255,0.2)',
                    }} />
                ))}
              </div>
            )}

            <p className="text-[#00c896] text-xs font-medium">
              {pendingCredits.length === 1 ? '1 booster disponible' : `${pendingCredits.length} boosters disponibles`}
            </p>
          </div>

        ) : (
          /* ── État vide : pack inactif centré ── */
          <>
            {/* Logo + tagline fixés en haut, indépendants */}
            <div className="absolute top-16 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none">
              <Image src="/assets/branding/void-favicon.png" alt="VOID" width={36} height={36} className="opacity-70" />
              <h1 className="text-xl font-black tracking-tight text-white">VOID Pack</h1>
              <p className="text-white/35 text-xs tracking-widest uppercase font-medium">
                Ouvre · Découvre · Collectionne
              </p>
            </div>

            {/* Pack seul, centré */}
            <div style={{
              width: 'min(72vw, 260px)',
              filter: 'drop-shadow(0 0 20px rgba(107,33,212,0.3))',
              animation: 'boosterFloat 3s ease-in-out infinite',
              opacity: 0.45,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/dos.png" alt="Booster" className="w-full h-auto block" draggable={false} />
            </div>

            <p className="text-white/25 text-xs text-center">
              {!user ? 'Connecte-toi avec Discord pour commencer' : 'Aucun booster disponible pour le moment'}
            </p>
          </>
        )}
      </div>
    </>
  )
}
