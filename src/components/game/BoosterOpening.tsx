'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
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

const RARITY_COLOR: Record<string, string> = {
  void:      '#a855f7',
  legendary: '#ff9a3d',
  epic:      '#b86dff',
  rare:      '#4aa3ff',
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

const SUSPENSE_MS: Record<string, number> = {
  void:      2200,
  legendary: 2800,
  epic:      1000,
  rare:       780,
  uncommon:   580,
  common:     420,
}

const PARTICLE_COUNT: Record<string, number> = {
  void: 60, legendary: 45, epic: 28, rare: 18, uncommon: 10, common: 6,
}

function hexToRgba(hex: string, alpha: number) {
  const v = hex.replace('#', '')
  const b = parseInt(v.length === 3 ? v.split('').map(c => c + c).join('') : v, 16)
  return `rgba(${(b >> 16) & 255}, ${(b >> 8) & 255}, ${b & 255}, ${alpha})`
}

interface Particle {
  id: number
  x: number
  y: number
  color: string
  size: number
  delay: number
  dur: number
}

const TEAR_Y = 14
type Phase = 'idle' | 'tearing' | 'torn' | 'cards'
type CardPhase = 'back' | 'suspense' | 'revealed'

export function BoosterOpening({ cards, boosterImageUrl, onClose }: Props) {
  const [phase, setPhase]           = useState<Phase>('idle')
  const [cardIndex, setCardIndex]   = useState(0)
  const [cardPhase, setCardPhase]   = useState<CardPhase>('back')
  const [revealedColor, setRevealedColor] = useState('')
  const [auraColor, setAuraColor]   = useState('')
  const [raysColor, setRaysColor]   = useState('')
  const [particles, setParticles]   = useState<Particle[]>([])
  const [tearParticles, setTearParticles] = useState<Particle[]>([])
  const [shake, setShake]           = useState(false)

  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([])
  const locked    = useRef(false)

  const currentCard = cards[cardIndex]
  const isLast      = cardIndex === cards.length - 1
  const rarity      = currentCard?.rarity ?? 'common'
  const packSrc     = boosterImageUrl || '/assets/dos.png'

  function later(fn: () => void, ms: number) {
    const t = setTimeout(fn, ms)
    timerRefs.current.push(t)
    return t
  }
  function clearTimers() {
    timerRefs.current.forEach(clearTimeout)
    timerRefs.current = []
    locked.current = false
  }

  useEffect(() => () => clearTimers(), []) // eslint-disable-line

  // Particules de déchirure (blanches/violettes)
  function spawnTearParticles() {
    const colors = ['#ffffff', '#a78bfa', '#7b2bff', '#c4b5fd']
    setTearParticles(Array.from({ length: 20 }, (_, i) => ({
      id: i, x: 30 + Math.random() * 40, y: TEAR_Y,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 2 + Math.random() * 4,
      delay: Math.random() * 0.1,
      dur: 0.6 + Math.random() * 0.4,
    })))
    setTimeout(() => setTearParticles([]), 1000)
  }

  // Particules de reveal — montent vers le haut depuis la carte
  function spawnRevealParticles(c: string, count: number) {
    const extras: string[] = rarity === 'void'
      ? ['#ff80d5', '#80e8ff', '#c080ff', '#ffffff']
      : rarity === 'legendary'
        ? ['#ffcc80', '#ffffff', '#ffd700']
        : [c, '#ffffff']

    setParticles(Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      x: 5 + Math.random() * 90,
      y: 10 + Math.random() * 80,
      color: extras[Math.floor(Math.random() * extras.length)],
      size: 3 + Math.random() * 5,
      delay: Math.random() * 0.4,
      dur: 0.9 + Math.random() * 0.8,
    })))
    later(() => setParticles([]), 2000)
  }

  // Aura + rays au reveal
  function setRevealFx(r: string, c: string) {
    const gA = r === 'void' ? .50 : r === 'legendary' ? .40 : r === 'epic' ? .30 : r === 'rare' ? .20 : .12
    const rA = r === 'void' ? .28 : r === 'legendary' ? .22 : r === 'epic' ? .16 : r === 'rare' ? .10 : .05
    setAuraColor(`radial-gradient(circle at center, ${hexToRgba(c, gA)} 0%, ${hexToRgba(c, gA * .3)} 30%, transparent 65%)`)
    setRaysColor(`conic-gradient(from 0deg, transparent 0deg, ${hexToRgba(c, rA)} 18deg, transparent 40deg, transparent 84deg, ${hexToRgba(c, rA * .8)} 106deg, transparent 136deg, transparent 178deg, ${hexToRgba(c, rA)} 206deg, transparent 234deg, transparent 292deg, ${hexToRgba(c, rA * .7)} 322deg, transparent 360deg)`)
  }

  // ── Tear ──────────────────────────────────────────────────────────────────
  const handleTear = useCallback(() => {
    if (phase !== 'idle') return
    setPhase('tearing')
    spawnTearParticles()
    setTimeout(() => setPhase('torn'), 80)
    setTimeout(() => { setPhase('cards'); setCardPhase('back'); locked.current = false }, 800)
  }, [phase]) // eslint-disable-line

  // ── Tap carte ─────────────────────────────────────────────────────────────
  const handleCardTap = useCallback(() => {
    if (locked.current) return

    if (cardPhase === 'back') {
      locked.current = true
      setCardPhase('suspense')
      const suspenseMs = SUSPENSE_MS[rarity] ?? 580

      // Screen shake pour legendary/void à mi-suspense
      if (rarity === 'legendary' || rarity === 'void') {
        later(() => { setShake(true); setTimeout(() => setShake(false), 400) }, suspenseMs * .6)
      }

      later(() => {
        const c = RARITY_COLOR[rarity] ?? '#9ca3af'
        setRevealedColor(c)
        setRevealFx(rarity, c)
        setCardPhase('revealed')
        spawnRevealParticles(c, PARTICLE_COUNT[rarity] ?? 10)
        locked.current = false
      }, suspenseMs)

    } else if (cardPhase === 'revealed') {
      clearTimers()
      setAuraColor(''); setRaysColor(''); setParticles([])
      setRevealedColor('')
      if (!isLast) {
        setCardIndex(i => i + 1)
        setCardPhase('back')
      } else {
        onClose()
      }
    }
  }, [cardPhase, rarity, isLast, onClose]) // eslint-disable-line

  return (
    <div
      className={cn('fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-all duration-700', shake && 'animate-[screenShake_0.4s_ease-in-out]')}
      style={{ background: phase === 'cards' ? RARITY_BG[rarity] : 'radial-gradient(ellipse at 50% 30%, #0d0520 0%, #000 100%)' }}
    >

      {/* ── IDLE / TEARING ── */}
      {(phase === 'idle' || phase === 'tearing') && (
        <div onClick={handleTear} className="relative flex flex-col items-center gap-8 cursor-pointer select-none">
          <div className="absolute inset-0 pointer-events-none overflow-visible">
            {tearParticles.map(p => (
              <div key={p.id} className="absolute rounded-full pointer-events-none"
                style={{
                  width: p.size, height: p.size, background: p.color,
                  left: `${p.x}%`, top: `${p.y}%`,
                  boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                  animation: `tearParticle ${p.dur}s ease-out ${p.delay}s forwards`,
                  '--vx': `${(Math.random() - .5) * 100}px`,
                  '--vy': `${-40 - Math.random() * 60}px`,
                } as React.CSSProperties} />
            ))}
          </div>

          <div style={{
            width: 'min(72vw, 300px)',
            filter: phase === 'tearing'
              ? 'drop-shadow(0 0 50px rgba(255,255,255,.4)) drop-shadow(0 0 30px rgba(123,43,255,.8))'
              : 'drop-shadow(0 0 35px rgba(123,43,255,.6)) drop-shadow(0 0 70px rgba(123,43,255,.25))',
            animation: 'boosterFloat 3s ease-in-out infinite',
            transform: phase === 'tearing' ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform .15s ease, filter .15s ease',
            position: 'relative',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={packSrc} alt="Booster" className="w-full h-auto block" draggable={false} />
            <div className={cn('absolute inset-x-0 h-px pointer-events-none transition-opacity duration-100', phase === 'tearing' ? 'opacity-100' : 'opacity-0')}
              style={{ top: `${TEAR_Y}%`, background: 'white', boxShadow: '0 0 12px 4px rgba(255,255,255,.8)' }} />
          </div>
          <p className="text-white/50 text-sm animate-pulse">Clique pour ouvrir</p>
        </div>
      )}

      {/* ── TORN ── */}
      {phase === 'torn' && (
        <div className="relative" style={{ width: 'min(72vw, 300px)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={packSrc} alt="" className="w-full h-auto invisible block" draggable={false} />
          <div className="absolute inset-x-0 top-0 overflow-hidden"
            style={{ height: `${TEAR_Y}%`, animation: 'splitTopSmall .7s cubic-bezier(.25,.46,.45,.94) forwards' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={packSrc} alt="" className="w-full block" style={{ position: 'absolute', top: 0, left: 0 }} draggable={false} />
          </div>
          <div className="absolute inset-x-0 overflow-hidden"
            style={{ top: `${TEAR_Y}%`, height: `${100 - TEAR_Y}%`, animation: 'splitBottomBig .7s cubic-bezier(.25,.46,.45,.94) forwards' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={packSrc} alt="" className="w-full block"
              style={{ position: 'absolute', top: `-${(TEAR_Y / (100 - TEAR_Y)) * 100}%`, left: 0 }} draggable={false} />
          </div>
          <div className="absolute inset-x-0 bg-white pointer-events-none"
            style={{ top: `${TEAR_Y}%`, height: '2px', transform: 'translateY(-50%)',
              boxShadow: '0 0 20px 10px rgba(255,255,255,.9)', animation: 'flashLine .7s ease-out forwards' }} />
        </div>
      )}

      {/* ── CARDS ── */}
      {phase === 'cards' && currentCard && (
        <div className="flex flex-col items-center gap-5 relative">

          {/* Indicateurs — neutres jusqu'au reveal */}
          <div className="flex items-center gap-1.5 z-10">
            {cards.map((_, i) => (
              <div key={i} className="rounded-full transition-all duration-300"
                style={{
                  width: i === cardIndex ? '20px' : '8px', height: '8px',
                  background: i < cardIndex
                    ? 'rgba(255,255,255,0.6)'
                    : i === cardIndex && cardPhase === 'revealed'
                      ? (RARITY_COLOR[cards[i].rarity] ?? '#fff')
                      : 'rgba(255,255,255,0.2)',
                }} />
            ))}
          </div>

          {/* Zone FX + carte */}
          <div className="relative" style={{ width: 'min(68vw, 260px)', aspectRatio: '0.714' }}>

            {/* fx-stage — déborde de -35% centré, tout en mix-blend-mode screen */}
            <div className="absolute pointer-events-none z-0" style={{ inset: '-35%' }}>

              {/* Aura */}
              {auraColor && cardPhase === 'revealed' && (
                <div style={{
                  position: 'absolute', left: '50%', top: '50%',
                  width: '640px', height: '640px',
                  transform: 'translate(-50%,-50%)',
                  background: auraColor,
                  borderRadius: '50%',
                  filter: 'blur(52px)',
                  animation: 'fxAura 1.4s ease-out forwards',
                }} />
              )}

              {/* Rays */}
              {raysColor && cardPhase === 'revealed' && (
                <div style={{
                  position: 'absolute', left: '50%', top: '50%',
                  width: '780px', height: '780px',
                  transform: 'translate(-50%,-50%)',
                  background: raysColor,
                  borderRadius: '50%',
                  mixBlendMode: 'screen',
                  animation: rarity === 'void' ? 'fxRaysMythic 2.0s ease-out forwards' : 'fxRays 1.6s ease-out forwards',
                }} />
              )}

              {/* Burst */}
              {revealedColor && cardPhase === 'revealed' && (
                <div style={{
                  position: 'absolute', left: '50%', top: '50%',
                  width: '560px', height: '560px',
                  transform: 'translate(-50%,-50%)',
                  background: `radial-gradient(circle at center, ${hexToRgba(revealedColor, .5)}, ${hexToRgba(revealedColor, .15)} 34%, transparent 60%)`,
                  borderRadius: '50%',
                  mixBlendMode: 'screen',
                  animation: rarity === 'void' ? 'fxBurstMythic 1.1s ease-out forwards' : 'fxBurst .9s ease-out forwards',
                }} />
              )}

              {/* Particules de reveal */}
              <div className="absolute overflow-visible pointer-events-none" style={{ inset: '35%' }}>
                {particles.map(p => (
                  <div key={p.id} className="absolute rounded-full"
                    style={{
                      width: `${p.size}px`, height: `${p.size}px`,
                      background: p.color,
                      left: `${p.x}%`, top: `${p.y}%`,
                      boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                      animation: `fxParticleRise ${p.dur}s ease-out ${p.delay}s forwards`,
                    }} />
                ))}
              </div>
            </div>

            {/* Carte flip 3D */}
            <div
              onClick={handleCardTap}
              className="absolute inset-0 cursor-pointer select-none z-10"
              style={{ perspective: '1000px' }}
            >
              <div className="w-full h-full relative transition-transform duration-[950ms]"
                style={{ transformStyle: 'preserve-3d', transform: cardPhase === 'revealed' ? 'rotateY(180deg)' : 'rotateY(0deg)', transitionTimingFunction: 'cubic-bezier(.16,.88,.18,1)' }}>

                {/* DOS */}
                <div className={cn('absolute inset-0 rounded-2xl overflow-hidden', cardPhase === 'suspense' && 'animate-[cardShake_.15s_ease-in-out_infinite]')}
                  style={{ backfaceVisibility: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.8)', border: '1px solid rgba(255,255,255,.08)' }}>
                  <Image src="/assets/dos.png" alt="" fill className="object-cover" />
                </div>

                {/* FACE — border neutre, glow seulement via revealedColor */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden bg-[#050210]"
                  style={{
                    backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
                    boxShadow: '0 20px 60px rgba(0,0,0,.8)',
                    border: '1px solid rgba(255,255,255,.08)',
                  }}>
                  {currentCard.artUrl
                    ? <Image src={currentCard.artUrl} alt={currentCard.name} fill className="object-contain" unoptimized />
                    : <div className="w-full h-full flex items-center justify-center">
                        <div className="w-20 h-20 rounded-full opacity-40"
                          style={{ background: `radial-gradient(circle, ${revealedColor || '#7b2bff'}, transparent)` }} />
                      </div>
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Nom + rareté */}
          <div className={cn('flex flex-col items-center gap-0.5 transition-all duration-300 z-10', cardPhase === 'revealed' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2')}>
            <p className="text-white font-bold text-base">{currentCard.name}</p>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: revealedColor || '#9ca3af' }}>
              {currentCard.rarity}
            </p>
          </div>

          <p className="text-white/30 text-xs z-10">
            {cardPhase === 'back' ? 'Clique pour révéler'
              : cardPhase === 'suspense' ? ''
              : isLast ? 'Clique pour terminer'
              : `Clique pour continuer · ${cardIndex + 1} / ${cards.length}`}
          </p>
        </div>
      )}
    </div>
  )
}
