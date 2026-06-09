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
  void:      'shadow-[0_0_40px_rgba(123,43,255,0.8),0_0_80px_rgba(123,43,255,0.4)]',
  legendary: 'shadow-[0_0_40px_rgba(245,158,11,0.8),0_0_80px_rgba(245,158,11,0.4)]',
  epic:      'shadow-[0_0_30px_rgba(168,85,247,0.7)]',
  rare:      'shadow-[0_0_25px_rgba(59,130,246,0.6)]',
  uncommon:  'shadow-[0_0_15px_rgba(34,197,94,0.5)]',
  common:    'shadow-none',
}

const RARITY_COLOR: Record<string, string> = {
  void:      '#7b2bff',
  legendary: '#f59e0b',
  epic:      '#a855f7',
  rare:      '#3b82f6',
  uncommon:  '#22c55e',
  common:    '#9ca3af',
}

type Phase = 'tear' | 'cards' | 'done'

export function BoosterOpening({ cards, boosterImageUrl, onClose }: Props) {
  const [phase, setPhase]           = useState<Phase>('tear')
  const [torn, setTorn]             = useState(false)
  const [revealedCards, setRevealed] = useState<boolean[]>(Array(cards.length).fill(false))
  const [currentCard, setCurrentCard] = useState(0)
  const allRevealed = revealedCards.every(Boolean)

  // Phase tear — cliquer pour déchirer
  const handleTear = useCallback(() => {
    if (torn) return
    setTorn(true)
    setTimeout(() => setPhase('cards'), 600)
  }, [torn])

  // Révéler une carte
  const revealCard = useCallback((i: number) => {
    setRevealed(prev => prev.map((v, idx) => idx === i ? true : v))
    setCurrentCard(Math.min(i + 1, cards.length - 1))
  }, [cards.length])

  // Tout révéler
  const revealAll = useCallback(() => {
    setRevealed(Array(cards.length).fill(true))
  }, [cards.length])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">

      {/* ── Phase TEAR ── */}
      {phase === 'tear' && (
        <div
          onClick={handleTear}
          className="flex flex-col items-center gap-6 cursor-pointer select-none"
        >
          <div className={cn(
            'relative w-[min(72vw,300px)] rounded-[20px] overflow-hidden transition-all duration-500',
            torn ? 'scale-110 opacity-0' : 'scale-100 opacity-100',
            'shadow-[0_0_60px_rgba(123,43,255,0.5),0_0_120px_rgba(123,43,255,0.2)]',
            'animate-[boosterFloat_3s_ease-in-out_infinite]',
          )}
          style={{ aspectRatio: '.68' }}>
            <Image
              src={boosterImageUrl ?? '/assets/dos.png'}
              alt="Booster"
              fill
              className="object-cover"
              priority
            />
            {/* Ligne de déchirure */}
            <div className={cn(
              'absolute inset-0 flex items-center justify-center transition-all duration-300',
              torn ? 'opacity-100' : 'opacity-0'
            )}>
              <div className="w-px h-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            </div>
          </div>
          <p className="text-white/60 text-sm animate-pulse">Clique pour ouvrir</p>
        </div>
      )}

      {/* ── Phase CARDS ── */}
      {phase === 'cards' && (
        <div className="flex flex-col items-center gap-6 w-full max-w-[520px] px-4">
          {/* Carte centrale mise en avant */}
          <div className="relative">
            {cards.map((card, i) => (
              <div
                key={card.id + i}
                onClick={() => !revealedCards[i] && revealCard(i)}
                style={{
                  position: i === currentCard ? 'relative' : 'absolute',
                  display: i === currentCard ? 'block' : 'none',
                }}
              >
                <CardReveal
                  card={card}
                  revealed={revealedCards[i]}
                  isCurrent={i === currentCard}
                />
              </div>
            ))}
          </div>

          {/* Indicateurs des cartes */}
          <div className="flex gap-2">
            {cards.map((card, i) => (
              <div
                key={i}
                onClick={() => setCurrentCard(i)}
                className={cn(
                  'w-2 h-2 rounded-full cursor-pointer transition-all',
                  i === currentCard ? 'scale-125' : 'scale-100',
                  revealedCards[i] ? 'opacity-100' : 'opacity-30',
                )}
                style={{ background: revealedCards[i] ? RARITY_COLOR[card.rarity] ?? '#fff' : '#fff' }}
              />
            ))}
          </div>

          {/* Boutons */}
          <div className="flex gap-3">
            {!allRevealed && (
              <button
                onClick={revealAll}
                className="px-6 py-2.5 rounded-xl border border-white/20 text-white/70 text-sm font-bold hover:bg-white/5 transition-colors"
              >
                Tout révéler
              </button>
            )}
            {allRevealed && (
              <button
                onClick={onClose}
                className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-[#7b2bff] to-[#4a1fa8] text-white text-sm font-bold hover:opacity-90 transition-opacity"
              >
                Terminer ✓
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Composant carte avec flip
function CardReveal({ card, revealed, isCurrent }: { card: Card; revealed: boolean; isCurrent: boolean }) {
  const rarityColor = RARITY_COLOR[card.rarity] ?? '#9ca3af'
  const glow = RARITY_GLOW[card.rarity] ?? ''

  return (
    <div
      className="relative cursor-pointer select-none"
      style={{ width: 'min(72vw, 280px)', aspectRatio: '.68', perspective: '1000px' }}
    >
      <div
        className="w-full h-full transition-transform duration-500"
        style={{
          transformStyle: 'preserve-3d',
          transform: revealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Dos */}
        <div
          className="absolute inset-0 rounded-[18px] overflow-hidden"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <Image src="/assets/dos.png" alt="" fill className="object-cover" />
        </div>

        {/* Face */}
        <div
          className={cn('absolute inset-0 rounded-[18px] overflow-hidden flex flex-col', glow)}
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: `radial-gradient(circle at 30% 20%, ${rarityColor}22, rgba(6,1,14,0.95))`,
            border: `1px solid ${rarityColor}40`,
          }}
        >
          {/* Artwork ou placeholder */}
          {card.artUrl ? (
            <Image src={card.artUrl} alt={card.name} fill className="object-cover" />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div
                className="w-24 h-24 rounded-full opacity-30"
                style={{ background: `radial-gradient(circle, ${rarityColor}, transparent)` }}
              />
            </div>
          )}

          {/* Info bas de carte */}
          <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-white font-bold text-sm truncate">{card.name}</p>
            <p className="text-xs font-semibold" style={{ color: rarityColor }}>
              {card.rarity.toUpperCase()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
