'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useGameStore } from '@/store/game'
import { useBoosterCredits } from '@/hooks/useBoosterCredits'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export function PackScreen() {
  const { user, profile }  = useGameStore(s => ({ user: s.user, profile: s.profile }))
  const { pendingCredits, loadCredits, removePendingCredit } = useBoosterCredits()
  const [loading, setLoading]   = useState(false)
  const [hint, setHint]         = useState('Clique pour ouvrir ton booster.')
  const [hintGreen, setHintGreen] = useState(false)
  const hasCredits = pendingCredits.length > 0

  // Mettre à jour le hint quand les crédits changent
  useEffect(() => {
    if (pendingCredits.length > 0) {
      setHint(pendingCredits.length === 1
        ? '1 booster disponible — clique pour l\'ouvrir !'
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

    // Recharger si vide
    if (pendingCredits.length === 0) {
      await loadCredits()
      return
    }

    const credit = pendingCredits[0]
    if (!credit) {
      setHint('Aucun booster disponible.')
      setHintGreen(false)
      setTimeout(() => { setHint('Clique pour ouvrir ton booster.') }, 3000)
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      await supabase.rpc('claim_booster_credit', { p_id: credit.id })
      removePendingCredit(credit.id)
      setHint('Booster ouvert ! 🎉')
      setHintGreen(true)
      // TODO: déclencher l'animation de déchirure
    } catch (e) {
      console.error(e)
      setHint('Erreur lors de l\'ouverture.')
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
    <div className="flex flex-col items-center gap-4 pt-4">
      <div className="relative flex flex-col items-center gap-3">
        {/* Badge crédits */}
        {hasCredits && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(0,80,55,0.85)] border border-[rgba(0,200,150,0.6)] text-[#00c896] text-xs font-bold animate-[badgePulse_2s_ease-in-out_infinite]">
            <Image src="/assets/branding/void-favicon.png" alt="" width={16} height={16} className="rounded-sm" />
            <span>
              {pendingCredits.length === 1
                ? '1 booster disponible'
                : `${pendingCredits.length} boosters disponibles`}
            </span>
          </div>
        )}

        {/* Carte booster */}
        <button
          onClick={handleClick}
          disabled={loading}
          style={{ aspectRatio: '.68' }}
          className={cn(
            'relative block cursor-pointer w-[min(82vw,340px)] rounded-[22px] overflow-visible',
            'animate-[boosterFloat_6.5s_ease-in-out_infinite]',
            hasCredits
              ? 'shadow-[0_0_50px_rgba(0,200,150,0.45),0_0_100px_rgba(0,200,150,0.15),0_30px_70px_rgba(0,0,0,0.8)]'
              : 'shadow-[0_0_60px_rgba(107,33,212,0.55),0_0_120px_rgba(107,33,212,0.22),0_30px_80px_rgba(0,0,0,0.8)]',
            loading && 'opacity-70 cursor-not-allowed',
          )}
        >
          <div className="absolute inset-0 rounded-[22px] overflow-hidden">
            <Image
              src="/assets/dos.png"
              alt="Booster VOID"
              fill
              className="object-cover"
              priority
            />
          </div>
        </button>
      </div>

      {/* Hint */}
      <p className={cn('text-xs text-center transition-colors', hintGreen ? 'text-[#00c896]' : 'text-white/45')}>
        {hint}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5 w-full mt-2">
        {stats.map(s => (
          <div key={s.label} className="rounded-[18px] bg-[rgba(12,14,22,0.62)] border border-white/[0.08] backdrop-blur-md p-3">
            <span className="block text-[10px] uppercase tracking-widest text-white/50 font-bold">{s.label}</span>
            <strong className="block mt-1.5 text-sm text-white">{s.value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
