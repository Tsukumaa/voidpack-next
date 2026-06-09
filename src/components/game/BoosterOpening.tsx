'use client'
import { useState, useCallback } from 'react'
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
  void:      '0 0 60px rgba(123,43,255,0.9), 0 0 120px rgba(123,43,255,0.4)',
  legendary: '0 0 60px rgba(245,158,11,0.9), 0 0 120px rgba(245,158,11,0.4)',
  epic:      '0 0 40px rgba(168,85,247,0.8), 0 0 80px rgba(168,85,247,0.3)',
  rare:      '0 0 30px rgba(59,130,246,0.7)',
  uncommon:  '0 0 20px rgba(34,197,94,0.5)',
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
  void:      'radial-gradient(ellipse at 50% 0%, #1a0a3a 0%, #050210 60%, #000 100%)',
  legendary: 'radial-gradient(ellipse at 50% 0%, #2a1800 0%, #100800 60%, #000 100%)',
  epic:      'radial-gradient(ellipse at 50% 0%, #1a0a2e 0%, #0a0518 60%, #000 100%)',
  rare:      'radial-gradient(ellipse at 50% 0%, #0a1628 0%, #040810 60%, #000 100%)',
  uncommon:  'radial-gradient(ellipse at 50% 0%, #0a1f10 0%, #040a06 60%, #000 100%)',
  common:    'radial-gradient(ellipse at 50% 0%, #111118 0%, #060608 60%, #000 100%)',
}

type Phase = 'idle' | 'tearing' | 'torn' | 'cards'

const CARD_W = 'min(68vw, 260px)'
const CARD_RATIO = '0.714' // ratio carte standard 2.5:3.5

export function BoosterOpening({ cards, boosterImageUrl, onClose }: Props) {
  const [phase, setPhase]         = useState<Phase>('idle')
  const [cardIndex, setCardIndex] = useState(0)
  const [revealed, setRevealed]   = useState(false)

  const currentCard = cards[cardIndex]
  const isLast = cardIndex === cards.length - 1
  const packSrc = boosterImageUrl && boosterImageUrl !== '/assets/dos.png'
    ? boosterImageUrl
    : '/assets/dos.png'

  const handleTear = useCallback(() => {
    if (phase !== 'idle') return
    setPhase('tearing')
    setTimeout(() => setPhase('torn'), 80)
    setTimeout(() => { setPhase('cards'); setRevealed(false) }, 750)
  }, [phase])

  const handleCardTap = useCallback(() => {
    if (!revealed) {
      setRevealed(true)
    } else if (!isLast) {
      setCardIndex(i => i + 1)
      setRevealed(false)
    } else {
      onClose()
    }
  }, [revealed, isLast, onClose])

  const rarity = currentCard?.rarity ?? 'common'
  const glowColor = RARITY_COLOR[rarity] ?? '#7b2bff'

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-all duration-700"
      style={{
        background: (phase === 'cards')
          ? RARITY_BG[rarity]
          : 'radial-gradient(ellipse at 50% 30%, #0d0520 0%, #000 100%)',
      }}
    >
      {/* ── IDLE : pack flottant ── */}
      {(phase === 'idle' || phase === 'tearing') && (
        <div
          onClick={handleTear}
          className="flex flex-col items-center gap-8 cursor-pointer select-none z-10"
        >
          {/* Halo */}
          <div className={cn(
            'absolute rounded-full blur-3xl transition-all duration-200 pointer-events-none',
            phase === 'tearing' ? 'w-96 h-96 bg-white/20' : 'w-72 h-72 bg-[#7b2bff]/15'
          )} />

          {/* Pack */}
          <div
            className={cn(
              'relative rounded-2xl overflow-hidden transition-transform duration-150',
              phase === 'tearing' ? 'scale-105' : 'scale-100',
            )}
            style={{
              width: 'min(72vw, 300px)',
              aspectRatio: '0.68',
              boxShadow: '0 0 60px rgba(123,43,255,0.5), 0 0 120px rgba(123,43,255,0.2)',
              animation: 'boosterFloat 3s ease-in-out infinite',
            }}
          >
            <Image
              src={packSrc}
              alt="Booster"
              fill
              className="object-cover"
              priority
              unoptimized={packSrc.startsWith('http')}
            />
            {/* Ligne de découpe */}
            <div className={cn(
              'absolute inset-x-0 top-1/2 -translate-y-1/2 h-px transition-opacity duration-100',
              phase === 'tearing'
                ? 'opacity-100 bg-white shadow-[0_0_12px_6px_rgba(255,255,255,0.7)]'
                : 'opacity-0 bg-transparent'
            )} />
          </div>

          <p className="text-white/50 text-sm animate-pulse relative z-10">Clique pour ouvrir</p>
        </div>
      )}

      {/* ── TORN : split haut/bas ── */}
      {phase === 'torn' && (
        <div
          className="relative"
          style={{ width: 'min(72vw, 300px)', aspectRatio: '0.68' }}
        >
          {/* Moitié haute */}
          <div
            className="absolute inset-x-0 top-0 overflow-hidden rounded-t-2xl"
            style={{ height: '50%', animation: 'splitTop 0.65s cubic-bezier(0.25,0.46,0.45,0.94) forwards' }}
          >
            <div className="relative w-full" style={{ height: '200%' }}>
              <Image src={packSrc} alt="" fill className="object-cover object-top" unoptimized={packSrc.startsWith('http')} />
            </div>
          </div>

          {/* Moitié basse */}
          <div
            className="absolute inset-x-0 bottom-0 overflow-hidden rounded-b-2xl"
            style={{ height: '50%', animation: 'splitBottom 0.65s cubic-bezier(0.25,0.46,0.45,0.94) forwards' }}
          >
            <div className="relative w-full" style={{ height: '200%', transform: 'translateY(-100%)' }}>
              <Image src={packSrc} alt="" fill className="object-cover object-bottom" unoptimized={packSrc.startsWith('http')} />
            </div>
          </div>

          {/* Flash central */}
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-white"
            style={{
              boxShadow: '0 0 20px 8px rgba(255,255,255,0.8)',
              animation: 'flashLine 0.65s ease-out forwards',
            }}
          />
        </div>
      )}

      {/* ── CARDS : révélation une par une ── */}
      {phase === 'cards' && currentCard && (
        <div className="flex flex-col items-center gap-5 z-10">

          {/* Indicateurs */}
          <div className="flex items-center gap-1.5">
            {cards.map((c, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === cardIndex ? '16px' : '8px',
                  height: '8px',
                  background: i <= cardIndex ? (RARITY_COLOR[cards[i].rarity] ?? '#fff') : 'rgba(255,255,255,0.2)',
                }}
              />
            ))}
          </div>

          {/* Carte avec flip 3D */}
          <div
            onClick={handleCardTap}
            className="cursor-pointer select-none"
            style={{ width: CARD_W, aspectRatio: CARD_RATIO, perspective: '1000px' }}
          >
            <div
              className="w-full h-full transition-transform duration-500 relative"
              style={{
                transformStyle: 'preserve-3d',
                transform: revealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* DOS */}
              <div
                className="absolute inset-0 rounded-2xl overflow-hidden"
                style={{
                  backfaceVisibility: 'hidden',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                }}
              >
                <Image src="/assets/dos.png" alt="" fill className="object-cover" />
              </div>

              {/* FACE — artwork pur, sans texte */}
              <div
                className="absolute inset-0 rounded-2xl overflow-hidden"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: '#050210',
                  boxShadow: RARITY_GLOW[currentCard.rarity] !== 'none'
                    ? RARITY_GLOW[currentCard.rarity]
                    : '0 20px 60px rgba(0,0,0,0.8)',
                  border: `1px solid ${glowColor}40`,
                }}
              >
                {currentCard.artUrl ? (
                  <Image
                    src={currentCard.artUrl}
                    alt={currentCard.name}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                ) : (
                  /* Placeholder si pas d'artwork */
                  <div className="w-full h-full flex items-center justify-center">
                    <div
                      className="w-20 h-20 rounded-full opacity-40"
                      style={{ background: `radial-gradient(circle, ${glowColor}, transparent)` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Nom + rareté SOUS la carte */}
          {revealed && (
            <div className="flex flex-col items-center gap-1 animate-[fadeIn_0.3s_ease-out]">
              <p className="text-white font-bold text-base">{currentCard.name}</p>
              <p className="text-xs font-bold tracking-widest uppercase" style={{ color: glowColor }}>
                {currentCard.rarity}
              </p>
            </div>
          )}

          {/* Hint */}
          <p className="text-white/35 text-xs">
            {!revealed
              ? 'Clique pour révéler'
              : isLast
                ? 'Clique pour terminer'
                : `Clique pour continuer · ${cardIndex + 1}/${cards.length}`}
          </p>
        </div>
      )}
    </div>
  )
}
