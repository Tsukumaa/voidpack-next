'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
import { useGameStore } from '@/store/game'
import { useBoosterCredits } from '@/hooks/useBoosterCredits'
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
  const order: string[] = []

  for (const c of credits) {
    const t = c.booster_type ?? 'void'
    if (!map[t]) {
      map[t] = []
      order.push(t)
    }
    map[t].push(c)
  }

  return { map, order }
}

export function PackScreen() {
  const { user } = useGameStore(s => ({ user: s.user }))
  const { pendingCredits, loadCredits, removePendingCredit } = useBoosterCredits()

  const [loading, setLoading] = useState(false)
  const [openedCards, setOpenedCards] = useState<CardResult[] | null>(null)
  const [openedType, setOpenedType] = useState<string>('void')
  const [openedImageUrl, setOpenedImageUrl] = useState<string>('/assets/dos.png')
  const [boosterImages, setBoosterImages] = useState<Record<string, string>>({})
  const [carouselIdx, setCarouselIdx] = useState(0)

  const touchStartX = useRef<number | null>(null)

  const { map: groups, order: types } = useMemo(
    () => groupCredits(pendingCredits),
    [pendingCredits]
  )

  const safeIdx = Math.min(carouselIdx, Math.max(0, types.length - 1))
  const activeType = types[safeIdx] ?? null
  const activeCredits = activeType ? (groups[activeType] ?? []) : []
  const activeCount = activeCredits.length
  const hasCredits = pendingCredits.length > 0

  useEffect(() => {
    if (!types.length) return

    fetch('/api/settings')
      .then(r => r.json())
      .then((data: Record<string, string>) => {
        const map: Record<string, string> = {}
        for (const type of types) {
          const key = `booster_image_${type}`
          if (data[key]) map[type] = data[key]
        }
        setBoosterImages(map)
      })
  }, [types.join(',')])

  const activeTypeRef = useRef(activeType)
  const activeCreditsRef = useRef(activeCredits)

  useEffect(() => {
    activeTypeRef.current = activeType
  }, [activeType])

  useEffect(() => {
    activeCreditsRef.current = activeCredits
  }, [activeCredits])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return

    const dx = e.changedTouches[0].clientX - touchStartX.current

    if (Math.abs(dx) > 40) {
      if (dx < 0) setCarouselIdx(i => Math.min(i + 1, types.length - 1))
      else setCarouselIdx(i => Math.max(i - 1, 0))
    }

    touchStartX.current = null
  }

  const handleOpen = useCallback(async () => {
    const type = activeTypeRef.current
    const credits = activeCreditsRef.current

    if (loading || !user || !type || !credits.length) return

    const credit = credits[0]
    setLoading(true)

    try {
      const claimRes = await fetch('/api/booster/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: credit.id }),
      })

      if (!claimRes.ok) throw new Error('claim error')

      const res = await fetch('/api/booster/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booster_type: type, count: 5 }),
      })

      if (!res.ok) throw new Error('open error')

      const { cards } = await res.json()

      setOpenedType(type)
      setOpenedImageUrl(boosterImages[type] || '/assets/dos.png')
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
          boosterType={openedType}
          onClose={() => {
            setOpenedCards(null)
            loadCredits()
          }}
        />
      )}

      {/* WRAPPER RESPONSIVE CLEAN */}
      <div
        className="
          relative
          flex
          flex-col
          items-center
          justify-center
          w-full
          min-h-[calc(100dvh-120px)]
          px-4
          py-6
          overflow-hidden
        "
      >
        {hasCredits ? (
          <div
            className="flex flex-col items-center gap-4 w-full"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div className="relative flex items-center justify-center w-full">

              {/* LEFT */}
              {types.length > 1 && safeIdx > 0 && (
                <button
                  onClick={() => setCarouselIdx(i => i - 1)}
                  className="absolute left-1 sm:left-3 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/5 border border-white/10 text-white/60"
                >
                  ‹
                </button>
              )}

              {/* PACK */}
              <button
                onClick={handleOpen}
                disabled={loading}
                className={cn(
                  'relative flex flex-col items-center',
                  loading && 'opacity-60 pointer-events-none'
                )}
              >
                {/* badge */}
                <div className="absolute -top-2 -right-2 z-30 min-w-7 h-7 px-2 rounded-full bg-[#7b2bff] text-xs font-bold flex items-center justify-center shadow-lg ring-2 ring-black/30"
                  style={{ boxShadow: '0 2px 10px rgba(123,43,255,0.6)' }}>
                  ×{activeCount}
                </div>

                {/* PACK IMAGE RESPONSIVE */}
                <div
                  className="
                    w-[65vw]
                    max-w-[280px]
                    min-w-[160px]
                    sm:w-[240px]
                    md:w-[300px]
                  "
                  style={{
                    filter:
                      'drop-shadow(0 0 25px rgba(123,43,255,.45))',
                    animation: 'boosterFloat 3s ease-in-out infinite',
                  }}
                >
                  <img
                    src={imgFor(activeType)}
                    alt={activeType ?? 'pack'}
                    className="w-full h-auto"
                    draggable={false}
                  />
                </div>

                <div className="mt-3 flex items-center h-5">
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-[#7b2bff]/30 border-t-[#7b2bff] rounded-full animate-spin" />
                  ) : (
                    <span className="text-white/60 text-xs sm:text-sm font-semibold capitalize">
                      {activeType === 'void'
                        ? 'VOID Pack'
                        : `${activeType} Pack`}
                    </span>
                  )}
                </div>
              </button>

              {/* RIGHT */}
              {types.length > 1 && safeIdx < types.length - 1 && (
                <button
                  onClick={() => setCarouselIdx(i => i + 1)}
                  className="absolute right-1 sm:right-3 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/5 border border-white/10 text-white/60"
                >
                  ›
                </button>
              )}
            </div>

            {/* DOTS */}
            {types.length > 1 && (
              <div className="flex gap-2">
                {types.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCarouselIdx(i)}
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: i === safeIdx ? 18 : 6,
                      background:
                        i === safeIdx
                          ? '#7b2bff'
                          : 'rgba(255,255,255,0.2)',
                    }}
                  />
                ))}
              </div>
            )}

            <p className="text-[#00c896] text-xs">
              {pendingCredits.length} booster
              {pendingCredits.length > 1 ? 's' : ''} disponible
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-6 w-full">
            <div className="flex flex-col items-center gap-2">
              <img
                src="/assets/branding/void-logo-polished.png"
                className="w-[70vw] max-w-[260px]"
                alt="VOID"
              />
              <p className="text-white/30 text-xs uppercase tracking-widest">
                Ouvre · Découvre · Collectionne
              </p>
            </div>

            <div
              className="w-[60vw] max-w-[220px] opacity-50"
              style={{ animation: 'boosterFloat 3s ease-in-out infinite' }}
            >
              <img src="/assets/dos.png" className="w-full h-auto" />
            </div>

            <p className="text-white/25 text-xs text-center">
              {!user
                ? 'Connecte-toi avec Discord'
                : 'Aucun booster disponible'}
            </p>
          </div>
        )}
      </div>
    </>
  )
}
