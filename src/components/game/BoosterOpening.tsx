'use client'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface Card {
  id: string
  name: string
  rarity: string
  family?: string
  artUrl?: string
}

interface Props {
  cards: Card[]
  boosterImageUrl?: string
  onClose: () => void
}

const RARITY_GLOW: Record<string, string> = {
  void:      '0_0_60px_rgba(123,43,255,0.9),0_0_120px_rgba(123,43,255,0.5)',
  legendary: '0_0_60px_rgba(245,158,11,0.9),0_0_120px_rgba(245,158,11,0.5)',
  epic:      '0_0_40px_rgba(168,85,247,0.8),0_0_80px_rgba(168,85,247,0.4)',
  rare:      '0_0_30px_rgba(59,130,246,0.7),0_0_60px_rgba(59,130,246,0.3)',
  uncommon:  '0_0_20px_rgba(34,197,94,0.6)',
  common:    'none',
}

const RARITY_COLOR: Record<string, string> = {
  void:      '#7b2bff',
  legendary: '#f59e0b',
  epic:      '#a855f7',
  rare:      '#3b82f6',
  uncommon:  '#22c55e',
  common:    '#9ca3af',
}

const RARITY_BG: Record<string, string> = {
  void:      'from-[#1a0a3a] via-[#0d051f] to-black',
  legendary: 'from-[#2a1a00] via-[#150d00] to-black',
  epic:      'from-[#1a0a2e] via-[#0d0518] to-black',
  rare:      'from-[#0a1628] via-[#050c18] to-black',
  uncommon:  'from-[#0a1f10] via-[#050f08] to-black',
  common:    'from-[#111118] via-[#080810] to-black',
}

// Phase : idle → tearing → torn → cards → done
type Phase = 'idle' | 'tearing' | 'torn' | 'cards' | 'done'

export function BoosterOpening({ cards, boosterImageUrl, onClose }: Props) {
  const [phase, setPhase]         = useState<Phase>('idle')
  const [cardIndex, setCardIndex] = useState(0)
  const [revealed, setRevealed]   = useState(false)
  const [particles, setParticles] = useState<{ x: number; y: number; color: string; size: number; vx: number; vy: number }[]>([])

  const currentCard = cards[cardIndex]
  const isLast = cardIndex === cards.length - 1

  // Lancer la déchirure
  const handleTear = useCallback(() => {
    if (phase !== 'idle') return
    setPhase('tearing')
    // Éclat de lumière + split
    setTimeout(() => setPhase('torn'), 80)
    // Transition vers les cartes
    setTimeout(() => {
      setPhase('cards')
      setRevealed(false)
    }, 750)
  }, [phase])

  // Tap sur la carte → flip reveal
  const handleCardTap = useCallback(() => {
    if (!revealed) {
      setRevealed(true)
      // Spawner particules selon la rareté
      if (['void', 'legendary', 'epic'].includes(currentCard.rarity)) {
        const color = RARITY_COLOR[currentCard.rarity]
        setParticles(Array.from({ length: 18 }, () => ({
          x: 50, y: 50,
          color,
          size: Math.random() * 4 + 2,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
        })))
        setTimeout(() => setParticles([]), 800)
      }
    } else {
      // Passer à la carte suivante
      if (!isLast) {
        setCardIndex(i => i + 1)
        setRevealed(false)
        setParticles([])
      } else {
        setPhase('done')
      }
    }
  }, [revealed, isLast, currentCard])

  // Fermer après "Terminer"
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const packSrc = boosterImageUrl ?? '/assets/dos.png'

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden">
      {/* Fond dynamique */}
      <div className={cn(
        'absolute inset-0 transition-all duration-700',
        phase === 'cards' || phase === 'done'
          ? `bg-gradient-to-b ${RARITY_BG[currentCard?.rarity ?? 'common']}`
          : 'bg-black/95'
      )} />

      {/* ── Phase IDLE : pack flottant ── */}
      {(phase === 'idle' || phase === 'tearing') && (
        <div
          onClick={handleTear}
          className="relative flex flex-col items-center gap-8 cursor-pointer select-none z-10"
        >
          {/* Halo de fond */}
          <div className={cn(
            'absolute inset-[-40px] rounded-full blur-3xl transition-all duration-300',
            phase === 'tearing'
              ? 'bg-white/30 scale-150'
              : 'bg-[#7b2bff]/20 scale-100'
          )} />

          {/* Pack entier */}
          <div
            className={cn(
              'relative rounded-[20px] overflow-hidden transition-all duration-150',
              phase === 'tearing' ? 'scale-105' : 'scale-100',
              'shadow-[0_0_60px_rgba(123,43,255,0.5),0_0_120px_rgba(123,43,255,0.2)]',
              'animate-[boosterFloat_3s_ease-in-out_infinite]',
            )}
            style={{ width: 'min(72vw, 300px)', aspectRatio: '.68' }}
          >
            <Image src={packSrc} alt="Booster" fill className="object-cover" priority />
            {/* Ligne de découpe */}
            <div className={cn(
              'absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px transition-all duration-150',
              phase === 'tearing'
                ? 'bg-white opacity-100 shadow-[0_0_12px_6px_rgba(255,255,255,0.6)]'
                : 'opacity-0'
            )} />
          </div>

          <p className="text-white/60 text-sm animate-pulse relative z-10">
            Clique pour ouvrir
          </p>
        </div>
      )}

      {/* ── Phase TORN : split haut/bas ── */}
      {phase === 'torn' && (
        <div
          className="relative z-10 select-none"
          style={{ width: 'min(72vw, 300px)', aspectRatio: '.68' }}
        >
          {/* Moitié HAUTE */}
          <div
            className="absolute left-0 right-0 overflow-hidden rounded-t-[20px] animate-[splitTop_0.65s_cubic-bezier(0.25,0.46,0.45,0.94)_forwards]"
            style={{ top: 0, height: '50%' }}
          >
            <div className="relative w-full" style={{ height: '200%' }}>
              <Image src={packSrc} alt="" fill className="object-cover object-top" />
            </div>
          </div>

          {/* Moitié BASSE */}
          <div
            className="absolute left-0 right-0 overflow-hidden rounded-b-[20px] animate-[splitBottom_0.65s_cubic-bezier(0.25,0.46,0.45,0.94)_forwards]"
            style={{ top: '50%', height: '50%' }}
          >
            <div className="relative w-full" style={{ height: '200%', transform: 'translateY(-100%)' }}>
              <Image src={packSrc} alt="" fill className="object-cover object-bottom" />
            </div>
          </div>

          {/* Flash de lumière au centre */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] bg-white shadow-[0_0_20px_8px_rgba(255,255,255,0.8)] animate-[flashLine_0.65s_ease-out_forwards]" />
        </div>
      )}

      {/* ── Phase CARDS : révélation une par une ── */}
      {(phase === 'cards' || phase === 'done') && currentCard && (
        <div className="relative z-10 flex flex-col items-center gap-6">

          {/* Compteur */}
          <div className="flex items-center gap-1.5">
            {cards.map((c, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-full transition-all duration-300',
                  i === cardIndex ? 'w-4 h-2' : 'w-2 h-2',
                  i < cardIndex ? 'opacity-100' : i === cardIndex ? 'opacity-100' : 'opacity-25'
                )}
                style={{ background: i <= cardIndex ? (RARITY_COLOR[cards[i].rarity] ?? '#fff') : '#fff' }}
              />
            ))}
          </div>

          {/* Carte avec flip */}
          <div
            onClick={phase === 'cards' ? handleCardTap : undefined}
            className={cn('relative select-none', phase === 'cards' && 'cursor-pointer')}
            style={{ width: 'min(72vw, 280px)', aspectRatio: '.68', perspective: '1000px' }}
          >
            {/* Particules rareté */}
            {particles.map((p, i) => (
              <div
                key={i}
                className="absolute rounded-full pointer-events-none animate-[particleBurst_0.8s_ease-out_forwards]"
                style={{
                  width: p.size, height: p.size,
                  background: p.color,
                  left: `${p.x}%`, top: `${p.y}%`,
                  '--vx': `${p.vx * 20}px`,
                  '--vy': `${p.vy * 20}px`,
                  boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                } as React.CSSProperties}
              />
            ))}

            {/* Flip container */}
            <div
              className="w-full h-full transition-transform duration-500"
              style={{
                transformStyle: 'preserve-3d',
                transform: revealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* DOS */}
              <div
                className="absolute inset-0 rounded-[18px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <Image src="/assets/dos.png" alt="" fill className="object-cover" />
              </div>

              {/* FACE */}
              <div
                className="absolute inset-0 rounded-[18px] overflow-hidden flex flex-col"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: `radial-gradient(circle at 30% 20%, ${RARITY_COLOR[currentCard.rarity] ?? '#7b2bff'}33, rgba(6,1,14,0.97))`,
                  border: `1px solid ${RARITY_COLOR[currentCard.rarity] ?? '#7b2bff'}50`,
                  boxShadow: RARITY_GLOW[currentCard.rarity] !== 'none'
                    ? `${RARITY_GLOW[currentCard.rarity]}`
                    : undefined,
                }}
              >
                {currentCard.artUrl ? (
                  <Image src={currentCard.artUrl} alt={currentCard.name} fill className="object-cover" />
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div
                      className="w-24 h-24 rounded-full opacity-40"
                      style={{ background: `radial-gradient(circle, ${RARITY_COLOR[currentCard.rarity] ?? '#7b2bff'}, transparent)` }}
                    />
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                  <p className="text-white font-bold text-sm truncate">{currentCard.name}</p>
                  <p className="text-xs font-bold tracking-wider" style={{ color: RARITY_COLOR[currentCard.rarity] ?? '#9ca3af' }}>
                    {currentCard.rarity.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Hint tap */}
          {phase === 'cards' && (
            <p className="text-white/40 text-xs animate-pulse">
              {!revealed
                ? 'Clique pour révéler'
                : isLast
                  ? 'Clique pour terminer'
                  : `Clique pour continuer · ${cardIndex + 1}/${cards.length}`}
            </p>
          )}

          {/* Bouton terminer (dernière carte révélée) */}
          {phase === 'done' && (
            <button
              onClick={handleClose}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#7b2bff] to-[#4a1fa8] text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-[0_0_30px_rgba(123,43,255,0.4)]"
            >
              Terminer ✓
            </button>
          )}
        </div>
      )}
    </div>
  )
}
