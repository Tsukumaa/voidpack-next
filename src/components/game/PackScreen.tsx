'use client'
import { useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { useGameStore } from '@/store/game'
import { useBoosterCredits } from '@/hooks/useBoosterCredits'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { BoosterOpening } from './BoosterOpening'

interface CardResult {
  id: string
  name: string
  rarity: string
  family?: string
  artUrl?: string
}

export function PackScreen() {
  const { user, profile }   = useGameStore(s => ({ user: s.user, profile: s.profile }))
  const { pendingCredits, loadCredits, removePendingCredit } = useBoosterCredits()
  const [loading, setLoading]             = useState(false)
  const [hint, setHint]                   = useState('Clique pour ouvrir ton booster.')
  const [hintGreen, setHintGreen]         = useState(false)
  const [openedCards, setOpenedCards]     = useState<CardResult[] | null>(null)
  const [boosterImageUrl, setBoosterImageUrl] = useState<string>('/assets/dos.png')
  const hasCredits = pendingCredits.length > 0

  // Charger l'image du booster depuis settings
  useEffect(() => {
    const boosterType = pendingCredits[0]?.booster_type ?? 'void'
    const key = `booster_image_${boosterType}`
    createClient()
      .from('settings')
      .select('value')
      .eq('key', key)
      .single()
      .then(({ data }) => {
        if (data?.value) setBoosterImageUrl(data.value)
        else setBoosterImageUrl('/assets/dos.png')
      })
  }, [pendingCredits])

  useEffect(() => {
    if (pendingCredits.length > 0) {
      setHint(pendingCredits.length === 1
        ? "1 booster disponible — clique pour l'ouvrir !"
        : `${pendingCredits.length} boosters disponibles — clique !`)
      setHintGreen(true)
    } else {
      setHint('Clique pour ouvrir ton booster.')
      setHintGreen(false)
    }
  }, [pendingCredits.length])

  const handleClick = useCallback(async () => {
    if (loading) return

    if (!user) {
      setHint('Connecte-toi avec Discord pour ouvrir un booster.')
      setHintGreen(false)
      return
    }

    if (pendingCredits.length === 0) {
      await loadCredits()
      if (pendingCredits.length === 0) {
        setHint('Aucun booster disponible.')
        setHintGreen(false)
        setTimeout(() => setHint('Clique pour ouvrir ton booster.'), 3000)
      }
      return
    }

    const credit = pendingCredits[0]
    setLoading(true)

    try {
      const supabase = createClient()

      const { error: claimErr } = await supabase.rpc('claim_booster_credit', { p_id: credit.id })
      if (claimErr) throw claimErr

      removePendingCredit(credit.id)

      const res = await fetch('/api/booster/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booster_type: credit.booster_type ?? 'void', count: 5 }),
      })

      if (!res.ok) throw new Error('Erreur lors de la génération du pack')

      const { cards } = await res.json()
      setOpenedCards(cards as CardResult[])

    } catch (e) {
      console.error(e)
      setHint("Erreur lors de l'ouverture.")
      setHintGreen(false)
    } finally {
      setLoading(false)
    }
  }, [loading, user, pendingCredits, loadCredits, removePendingCredit])

  const stats = [
    { label: 'Collection', value: `${profile?.packs_opened ?? 0} cartes` },
    { label: 'Rareté max',  value: profile?.highest_rarity ?? '—' },
    { label: 'Packs',       value: String(profile?.packs_opened ?? '—') },
  ]

  return (
    <>
      {openedCards && (
        <BoosterOpening
          cards={openedCards}
          boosterImageUrl={boosterImageUrl}
          onClose={() => { setOpenedCards(null); loadCredits() }}
        />
      )}

      <div className="flex flex-col items-center gap-4 pt-4">
        <div className="relative flex flex-col items-center gap-3">
          {hasCredits && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(0,80,55,0.85)] border border-[rgba(0,200,150,0.6)] text-[#00c896] text-xs font-bold animate-badge-pulse">
              <Image src="/assets/branding/void-favicon.png" alt="" width={16} height={16} className="rounded-sm" />
              <span>
                {pendingCredits.length === 1
                  ? '1 booster disponible'
                  : `${pendingCredits.length} boosters disponibles`}
              </span>
            </div>
          )}

          <button
            onClick={handleClick}
            disabled={loading}
            style={{ aspectRatio: '.68' }}
            className={cn(
              'relative block cursor-pointer w-[min(82vw,340px)] rounded-[22px] overflow-visible',
              'animate-booster-float',
              hasCredits
                ? 'shadow-[0_0_50px_rgba(0,200,150,0.45),0_0_100px_rgba(0,200,150,0.15),0_30px_70px_rgba(0,0,0,0.8)]'
                : 'shadow-[0_0_60px_rgba(107,33,212,0.55),0_0_120px_rgba(107,33,212,0.22),0_30px_80px_rgba(0,0,0,0.8)]',
              loading && 'opacity-70 cursor-not-allowed',
            )}
          >
            <div className="absolute inset-0 rounded-[22px] overflow-hidden">
              <Image src={boosterImageUrl} alt="Booster VOID" fill className="object-cover" priority unoptimized={boosterImageUrl.startsWith('http')} />
            </div>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-[22px] bg-black/40">
                <div className="w-8 h-8 border-2 border-[#7b2bff]/30 border-t-[#7b2bff] rounded-full animate-spin" />
              </div>
            )}
          </button>
        </div>

        <p className={cn('text-xs text-center transition-colors', hintGreen ? 'text-[#00c896]' : 'text-white/45')}>
          {hint}
        </p>

        <div className="grid grid-cols-3 gap-2.5 w-full mt-2">
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
