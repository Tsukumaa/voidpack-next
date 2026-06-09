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

const PACK_W = 'min(68vw, 260px)'
const CARD_W = 'min(68vw, 260px)'
const CARD_RATIO = '0.714'

export function BoosterOpening({ cards, boosterImageUrl, onClose }: Props) {
  const [phase, setPhase]         = useState<Phase>('idle')
  const [cardIndex, setCardIndex] = useState(0)
  const [revealed, setRevealed]   = useState(false)

  const currentCard = cards[cardIndex]
  const isLast      = cardIndex === cards.length - 1
  const rarity      = currentCard?.rarity ?? 'common'
  const glowColor   = RARITY_COLOR[rarity] ?? '#7b2bff'
  const packSrc     = boosterImageUrl || '/assets/dos.png'

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

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-all duration-700"
      style={{
        background: phase === 'cards'
          ? RARITY_BG[rarity]
          : 'radial-gradient(ellipse at 50% 30%, #0d0520 0%, #000 100%)',
      }}
    >

      {/* ── IDLE / TEARING : pack flottant libre ── */}
      {(phase === 'idle' || phase === 'tearing') && (
        <div
          onClick={handleTear}
          className="flex flex-col items-center gap-8 cursor-pointer select-none"
        >
          <div
            style={{
              width: PACK_W,
              filter: phase === 'tearing'
                ? 'drop-shadow(0 0 60px rgba(255,255,255,0.5)) drop-shadow(0 0 30px rgba(123,43,255,0.8))'
                : 'drop-shadow(0 0 40px rgba(123,43,255,0.6)) drop-shadow(0 0 80px rgba(123,43,255,0.25))',
              animation: 'boosterFloat 3s ease-in-out infinite',
              transform: phase === 'tearing' ? 'scale(1.05)' : 'scale(1)',
              transition: 'transform 0.15s ease, filter 0.15s ease',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={packSrc} alt="Booster" className="w-full h-auto block" draggable={false} />
          </div>
          <p className="text-white/50 text-sm animate-pulse">Clique pour ouvrir</p>
        </div>
      )}

      {/* ── TORN : split haut/bas ── */}
      {phase === 'torn' && (
        <div
          className="relative overflow-hidden"
          style={{ width: PACK_W }}
        >
          {/* Image de référence invisible pour tenir la hauteur */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={packSrc} alt="" className="w-full h-auto invisible block" draggable={false} />

          {/* Moitié haute — clip du haut */}
          <div
            className="absolute inset-x-0 top-0"
            style={{
              height: '50%',
              overflow: 'hidden',
              animation: 'splitTop 0.65s cubic-bezier(0.25,0.46,0.45,0.94) forwards',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={packSrc}
              alt=""
              className="w-full block"
              style={{ position: 'absolute', top: 0, left: 0 }}
              draggable={false}
            />
          </div>

          {/* Moitié basse — clip du bas */}
          <div
            className="absolute inset-x-0 bottom-0"
            style={{
              height: '50%',
              overflow: 'hidden',
              animation: 'splitBottom 0.65s cubic-bezier(0.25,0.46,0.45,0.94) forwards',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={packSrc}
              alt=""
              className="w-full block"
              style={{ position: 'absolute', bottom: 0, left: 0 }}
              draggable={false}
            />
          </div>

          {/* Flash de lumière central */}
          <div
            className="absolute inset-x-0 bg-white pointer-events-none"
            style={{
              top: '50%',
              height: '2px',
              transform: 'translateY(-50%)',
              boxShadow: '0 0 20px 10px rgba(255,255,255,0.85)',
              animation: 'flashLine 0.65s ease-out forwards',
            }}
          />
        </div>
      )}

      {/* ── CARDS : révélation une par une ── */}
      {phase === 'cards' && currentCard && (
        <div className="flex flex-col items-center gap-5">

          {/* Indicateurs */}
          <div className="flex items-center gap-1.5">
            {cards.map((c, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width:  i === cardIndex ? '20px' : '8px',
                  height: '8px',
                  background: i <= cardIndex
                    ? (RARITY_COLOR[cards[i].rarity] ?? '#fff')
                    : 'rgba(255,255,255,0.15)',
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
              className="w-full h-full relative transition-transform duration-500"
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

              {/* FACE — artwork pur plein cadre */}
              <div
                className="absolute inset-0 rounded-2xl overflow-hidden bg-[#050210]"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  boxShadow: RARITY_GLOW[rarity] !== 'none' ? RARITY_GLOW[rarity] : '0 20px 60px rgba(0,0,0,0.8)',
                  border: `1px solid ${glowColor}50`,
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

          {/* Nom + rareté sous la carte, apparaît après reveal */}
          <div
            className={cn(
              'flex flex-col items-center gap-0.5 transition-all duration-300',
              revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            )}
          >
            <p className="text-white font-bold text-base">{currentCard.name}</p>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: glowColor }}>
              {currentCard.rarity}
            </p>
          </div>

          {/* Hint */}
          <p className="text-white/30 text-xs">
            {!revealed
              ? 'Clique pour révéler'
              : isLast
                ? 'Clique pour terminer'
                : `Clique pour continuer · ${cardIndex + 1} / ${cards.length}`}
          </p>
        </div>
      )}
    </div>
  )
}
