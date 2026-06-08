'use client'
import { useState, useCallback } from 'react'
import { useGameStore } from '@/store/game'
import { useBoosterCredits } from '@/hooks/useBoosterCredits'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import Image from 'next/image'

export function PackScreen() {
  const { user, profile }                        = useGameStore(s => ({ user: s.user, profile: s.profile }))
  const { pendingCredits, loadCredits, removePendingCredit } = useBoosterCredits()
  const [loading, setLoading]                    = useState(false)
  const [hintMsg, setHintMsg]                    = useState('Clique pour ouvrir ton booster.')
  const [hintGreen, setHintGreen]                = useState(false)

  const hasCredits = pendingCredits.length > 0
  const supabase   = createClient()

  const handleClick = useCallback(async () => {
    if (loading) return

    if (!user) {
      setHintMsg('Connecte-toi avec Discord pour ouvrir un booster.')
      setHintGreen(false)
      return
    }

    // Recharger si vide
    if (pendingCredits.length === 0) {
      await loadCredits()
    }

    const credit = pendingCredits[0]
    if (!credit) {
      setHintMsg('Aucun booster disponible. Obtiens-en sur Twitch !')
      setHintGreen(false)
      setTimeout(() => {
        setHintMsg('Clique pour ouvrir ton booster.')
      }, 3000)
      return
    }

    setLoading(true)
    try {
      await supabase.rpc('claim_booster_credit', { p_id: credit.id })
      removePendingCredit(credit.id)
      // TODO: déclencher l'animation de déchirure puis le reveal
      setHintMsg('Booster ouvert !')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [loading, user, pendingCredits]) // eslint-disable-line

  // Stats rapides
  const stats = [
    { label: 'Collection', value: String(profile?.packs_opened ?? 0) + ' cartes' },
    { label: 'Rareté max', value: profile?.highest_rarity ?? '—' },
    { label: 'Packs',      value: String(profile?.packs_opened ?? '—') },
  ]

  return (
    <div className="flex flex-col items-center gap-4 pt-4">
      {/* Zone booster */}
      <div className="relative flex flex-col items-center gap-3">
        {/* Badge crédits */}
        {hasCredits && (
          <div className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-full',
            'bg-[rgba(0,80,55,0.85)] border border-[rgba(0,200,150,0.6)]',
            'text-[#00c896] text-xs font-bold',
            'animate-badge-pulse',
          )}>
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
          className={cn(
            'relative block cursor-pointer',
            'w-[min(82vw,340px)] rounded-[22px] overflow-visible',
            'animate-booster-float',
            'transition-all duration-300',
            hasCredits
              ? 'shadow-[0_0_50px_rgba(0,200,150,0.45),0_0_100px_rgba(0,200,150,0.15),0_30px_70px_rgba(0,0,0,0.8)]'
              : 'shadow-[0_0_60px_rgba(107,33,212,0.55),0_0_120px_rgba(107,33,212,0.22),0_30px_80px_rgba(0,0,0,0.8)]',
            loading && 'opacity-70 cursor-not-allowed',
          )}
          style={{ aspectRatio: '.68' }}
        >
          {/* Inner clipper */}
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
      <p className={cn(
        'text-xs text-center transition-colors',
        hintGreen ? 'text-[#00c896]' : 'text-white/45',
      )}>
        {hintMsg}
      </p>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-2.5 w-full mt-2">
        {stats.map(s => (
          <div
            key={s.label}
            className="rounded-[18px] bg-[rgba(12,14,22,0.62)] border border-white/8 backdrop-blur-md p-3"
          >
            <span className="block text-[10px] uppercase tracking-widest text-white/50 font-bold">
              {s.label}
            </span>
            <strong className="block mt-1.5 text-sm text-white">{s.value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
