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

// Durée du suspense par rareté (ms)
const SUSPENSE_MS: Record<string, number> = {
  void:      2200,
  legendary: 2800,
  epic:      1000,
  rare:       780,
  uncommon:   580,
  common:     420,
}

// Nombre de particules par rareté
const PARTICLE_COUNT: Record<string, number> = {
  void: 70, legendary: 55, epic: 35, rare: 20, uncommon: 10, common: 6,
}

const TEAR_Y = 14
type Phase = 'idle' | 'tearing' | 'torn' | 'cards'
type CardPhase = 'back' | 'suspense' | 'revealed'

function hexToRgba(hex: string, alpha: number) {
  const v = hex.replace('#', '')
  const b = parseInt(v.length === 3 ? v.split('').map(c => c + c).join('') : v, 16)
  return `rgba(${(b >> 16) & 255}, ${(b >> 8) & 255}, ${b & 255}, ${alpha})`
}

// ── Lightning canvas ──────────────────────────────────────────────────────────
function drawLightning(canvas: HTMLCanvasElement, rarity: string, color: string) {
  const presets: Record<string, { dur: number; rings: number; sparks: number; bloom: number }> = {
    rare:      { dur: 520,  rings: 1, sparks: 16, bloom: .30 },
    uncommon:  { dur: 400,  rings: 1, sparks: 10, bloom: .20 },
    epic:      { dur: 760,  rings: 2, sparks: 26, bloom: .42 },
    legendary: { dur: 980,  rings: 2, sparks: 34, bloom: .56 },
    void:      { dur: 1180, rings: 3, sparks: 48, bloom: .68 },
  }
  const cfg = presets[rarity] || presets.rare
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const rect = canvas.getBoundingClientRect()
  canvas.width  = Math.max(1, Math.floor(rect.width  * dpr))
  canvas.height = Math.max(1, Math.floor(rect.height * dpr))
  canvas.style.width  = `${rect.width}px`
  canvas.style.height = `${rect.height}px`
  canvas.style.opacity = '1'

  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const cx = rect.width / 2, cy = rect.height / 2

  const sparks = Array.from({ length: cfg.sparks }, () => ({
    a: Math.random() * Math.PI * 2,
    r: 8 + Math.random() * 24,
    sp: 45 + Math.random() * 120,
    sz: 1 + Math.random() * 3,
    delay: Math.random() * .22,
    life: .45 + Math.random() * .55,
  }))

  const t0 = performance.now()
  let raf: number

  function frame(now: number) {
    const t = Math.min(1, (now - t0) / cfg.dur)
    const fade = t < .18 ? t / .18 : Math.max(0, 1 - ((t - .18) / .82))
    ctx.clearRect(0, 0, rect.width, rect.height)

    // Bloom central
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rect.width, rect.height) * .7)
    g.addColorStop(0, `rgba(255,255,255,${.28 * fade})`)
    g.addColorStop(.18, `rgba(255,255,255,${cfg.bloom * fade})`)
    g.addColorStop(.36, hexToRgba(color, .28 * fade))
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, rect.width, rect.height)

    // Rings expansifs
    for (let i = 0; i < cfg.rings; i++) {
      const p = Math.max(0, Math.min(1, (t - i * .09) / .55))
      if (p <= 0 || p >= 1) continue
      const rr = Math.min(rect.width, rect.height) * (.32 + p * .34 + i * .06)
      ctx.beginPath()
      ctx.arc(cx, cy, rr, 0, Math.PI * 2)
      ctx.strokeStyle = hexToRgba(color, (1 - p) * .45 * fade)
      ctx.lineWidth = 3.5 - p * 2
      ctx.shadowBlur = 18; ctx.shadowColor = color
      ctx.stroke(); ctx.shadowBlur = 0
    }

    // Arcs électriques
    const arcCount = rarity === 'void' ? 4 : rarity === 'legendary' ? 3 : rarity === 'epic' ? 2 : 1
    for (let k = 0; k < arcCount; k++) {
      const base = t * 2.2 + k * (Math.PI * 2 / arcCount)
      const rad  = Math.min(rect.width, rect.height) * (.44 + k * .03)
      ctx.beginPath()
      for (let s = 0; s <= 24; s++) {
        const q = s / 24
        const ang = base + q * .95
        const wob = Math.sin(q * 8 + t * 9 + k) * 7
        const x = cx + Math.cos(ang) * (rad + wob)
        const y = cy + Math.sin(ang) * (rad + wob)
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = hexToRgba(color, .42 * fade)
      ctx.lineWidth = 4; ctx.shadowBlur = 14; ctx.shadowColor = color; ctx.stroke()
      ctx.strokeStyle = `rgba(255,255,255,${.75 * fade})`
      ctx.lineWidth = 1.2; ctx.shadowBlur = 0; ctx.stroke()
    }

    // Sparks
    sparks.forEach(spark => {
      const life = (t - spark.delay) / spark.life
      if (life <= 0 || life >= 1) return
      const e = 1 - Math.pow(1 - life, 3)
      const x = cx + Math.cos(spark.a) * (spark.r + spark.sp * e)
      const y = cy + Math.sin(spark.a) * (spark.r + spark.sp * e)
      const alpha = (1 - life) * fade
      ctx.beginPath()
      ctx.fillStyle = hexToRgba(color, alpha * .55)
      ctx.shadowBlur = 12; ctx.shadowColor = color
      ctx.arc(x, y, spark.sz * 2, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath()
      ctx.fillStyle = `rgba(255,255,255,${alpha})`
      ctx.shadowBlur = 0
      ctx.arc(x, y, spark.sz, 0, Math.PI * 2); ctx.fill()
    })

    if (t < 1) raf = requestAnimationFrame(frame)
    else { ctx.clearRect(0, 0, rect.width, rect.height); canvas.style.opacity = '0' }
  }
  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}

// ── Composant principal ────────────────────────────────────────────────────────
export function BoosterOpening({ cards, boosterImageUrl, onClose }: Props) {
  const [phase, setPhase]         = useState<Phase>('idle')
  const [cardIndex, setCardIndex] = useState(0)
  const [cardPhase, setCardPhase] = useState<CardPhase>('back')
  const [screenFlash, setScreenFlash] = useState<{ color: string; intensity: string } | null>(null)
  const [shake, setShake]         = useState(false)
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; vx: number; vy: number; color: string; size: number }[]>([])
  const [tearParticles, setTearParticles] = useState<typeof particles>([])
  const [auraColor, setAuraColor] = useState('')
  const [raysColor, setRaysColor] = useState('')

  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const cancelLightRef = useRef<(() => void) | null>(null)
  const timerRefs  = useRef<ReturnType<typeof setTimeout>[]>([])
  const locked     = useRef(false)

  const currentCard = cards[cardIndex]
  const isLast      = cardIndex === cards.length - 1
  const rarity      = currentCard?.rarity ?? 'common'
  const color       = RARITY_COLOR[rarity] ?? '#9ca3af'
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

  useEffect(() => () => { clearTimers(); cancelLightRef.current?.() }, []) // eslint-disable-line

  // Particules de déchirure
  function spawnTearParticles() {
    const colors = ['#ffffff', '#a78bfa', '#7b2bff', '#c4b5fd', '#e0d7ff']
    setTearParticles(Array.from({ length: 24 }, (_, i) => ({
      id: i, x: 50, y: TEAR_Y,
      vx: (Math.random() - 0.5) * 120,
      vy: (Math.random() - 0.8) * 80,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 5 + 2,
    })))
    setTimeout(() => setTearParticles([]), 900)
  }

  // Particules de rareté (stage + rarity)
  function spawnParticles(c: string, count: number) {
    setParticles(Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      x: 2 + Math.random() * 96,
      y: 20 + Math.random() * 65,
      vx: (Math.random() - .5) * 60,
      vy: (Math.random() - .8) * 60,
      color: c, size: .8 + Math.random() * 1.2,
    })))
    later(() => setParticles([]), 1800)
  }

  // Aura + rayons du suspense
  function setNeutralFx() {
    setAuraColor(`radial-gradient(circle at center, rgba(255,255,255,.18) 0%, rgba(255,255,255,.06) 34%, transparent 72%)`)
    setRaysColor(`conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,.10) 22deg, transparent 42deg, transparent 88deg, rgba(184,109,255,.08) 110deg, transparent 140deg, transparent 180deg, rgba(74,163,255,.08) 210deg, transparent 238deg, transparent 300deg, rgba(255,219,87,.08) 326deg, transparent 360deg)`)
  }
  function setRevealFxColors(r: string, c: string) {
    const gA = r === 'void' ? .56 : r === 'legendary' ? .44 : r === 'epic' ? .32 : r === 'rare' ? .22 : .14
    const rA = r === 'void' ? .32 : r === 'legendary' ? .24 : r === 'epic' ? .18 : r === 'rare' ? .12 : .06
    setAuraColor(`radial-gradient(circle at center, ${hexToRgba(c, gA)} 0%, ${hexToRgba(c, gA * .38)} 26%, transparent 68%)`)
    setRaysColor(`conic-gradient(from 0deg, transparent 0deg, ${hexToRgba(c, rA)} 18deg, transparent 40deg, transparent 84deg, ${hexToRgba(c, rA * .9)} 106deg, transparent 136deg, transparent 178deg, ${hexToRgba(c, rA)} 206deg, transparent 234deg, transparent 292deg, ${hexToRgba(c, rA * .72)} 322deg, transparent 360deg)`)
  }

  // Screen flash + shake
  function triggerImpact(r: string, c: string) {
    setScreenFlash({ color: c, intensity: r })
    later(() => setScreenFlash(null), r === 'void' ? 1400 : r === 'legendary' ? 900 : 700)
    if (r === 'legendary' || r === 'void') {
      setShake(true)
      later(() => setShake(false), r === 'void' ? 750 : 550)
    }
    // Lightning
    cancelLightRef.current?.()
    if (canvasRef.current && r !== 'common') {
      cancelLightRef.current = drawLightning(canvasRef.current, r, c)
    }
    // Particules
    const cnt = PARTICLE_COUNT[r] ?? 10
    spawnParticles(c, cnt)
    if (r === 'void') {
      later(() => spawnParticles('#ff80d5', 30), 160)
      later(() => spawnParticles('#80e8ff', 20), 320)
    } else if (r === 'legendary') {
      later(() => spawnParticles(c, Math.floor(cnt * .6)), 200)
    }
  }

  // ── Tear ──────────────────────────────────────────────────────────────────
  const handleTear = useCallback(() => {
    if (phase !== 'idle') return
    setPhase('tearing')
    spawnTearParticles()
    setTimeout(() => setPhase('torn'), 80)
    setTimeout(() => {
      setPhase('cards')
      setCardPhase('back')
      locked.current = false
    }, 800)
  }, [phase]) // eslint-disable-line

  // ── Tap sur la carte ───────────────────────────────────────────────────────
  const handleCardTap = useCallback(() => {
    if (locked.current) return

    if (cardPhase === 'back') {
      locked.current = true
      setCardPhase('suspense')
      // Pendant le suspense : RIEN — pas d'aura, pas de rays, pas de particules
      // Juste le tremblement de la carte
      const suspenseMs = SUSPENSE_MS[rarity] ?? 580

      later(() => {
        // Reveal — seulement là on montre les couleurs
        const c = RARITY_COLOR[rarity] ?? '#9ca3af'
        setRevealFxColors(rarity, c)
        setCardPhase('revealed')
        triggerImpact(rarity, c)
        locked.current = false
      }, suspenseMs)

    } else if (cardPhase === 'revealed') {
      clearTimers()
      cancelLightRef.current?.()
      setAuraColor(''); setRaysColor(''); setParticles([])
      if (!isLast) {
        setCardIndex(i => i + 1)
        setCardPhase('back')
      } else {
        onClose()
      }
    }
  }, [cardPhase, rarity, isLast, onClose]) // eslint-disable-line

  const flashAlpha = screenFlash
    ? rarity === 'void' ? .7 : rarity === 'legendary' ? .55 : rarity === 'epic' ? .42 : .3
    : 0

  return (
    <div
      className={cn('fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-all duration-700', shake && 'animate-[screenShake_0.55s_ease-in-out]')}
      style={{ background: phase === 'cards' ? RARITY_BG[rarity] : 'radial-gradient(ellipse at 50% 30%, #0d0520 0%, #000 100%)' }}
    >
      {/* Screen flash */}
      {screenFlash && (
        <div
          className="fixed inset-0 pointer-events-none z-[200] transition-opacity duration-300"
          style={{ background: `radial-gradient(circle at center, ${hexToRgba(screenFlash.color, flashAlpha)} 0%, ${hexToRgba(screenFlash.color, flashAlpha * .35)} 34%, transparent 70%)` }}
        />
      )}

      {/* ── IDLE / TEARING ── */}
      {(phase === 'idle' || phase === 'tearing') && (
        <div onClick={handleTear} className="relative flex flex-col items-center gap-8 cursor-pointer select-none">
          {/* Particules tear */}
          <div className="absolute inset-0 pointer-events-none overflow-visible">
            {tearParticles.map(p => (
              <div key={p.id} className="absolute rounded-full"
                style={{ width: p.size, height: p.size, background: p.color, left: `${p.x}%`, top: `${p.y}%`,
                  boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                  animation: 'tearParticle 0.9s ease-out forwards',
                  '--vx': `${p.vx}px`, '--vy': `${p.vy}px`,
                } as React.CSSProperties} />
            ))}
          </div>

          <div style={{
            width: 'min(72vw, 300px)',
            filter: phase === 'tearing'
              ? 'drop-shadow(0 0 50px rgba(255,255,255,0.4)) drop-shadow(0 0 30px rgba(123,43,255,0.8))'
              : 'drop-shadow(0 0 35px rgba(123,43,255,0.6)) drop-shadow(0 0 70px rgba(123,43,255,0.25))',
            animation: 'boosterFloat 3s ease-in-out infinite',
            transform: phase === 'tearing' ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform 0.15s ease, filter 0.15s ease',
            position: 'relative',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={packSrc} alt="Booster" className="w-full h-auto block" draggable={false} />
            <div className={cn('absolute inset-x-0 h-px pointer-events-none transition-opacity duration-100', phase === 'tearing' ? 'opacity-100' : 'opacity-0')}
              style={{ top: `${TEAR_Y}%`, background: 'white', boxShadow: '0 0 12px 4px rgba(255,255,255,0.8)' }} />
          </div>
          <p className="text-white/50 text-sm animate-pulse">Clique pour ouvrir</p>
        </div>
      )}

      {/* ── TORN ── */}
      {phase === 'torn' && (
        <div className="relative" style={{ width: 'min(72vw, 300px)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={packSrc} alt="" className="w-full h-auto invisible block" draggable={false} />
          <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: `${TEAR_Y}%`, animation: 'splitTopSmall 0.7s cubic-bezier(0.25,0.46,0.45,0.94) forwards' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={packSrc} alt="" className="w-full block" style={{ position: 'absolute', top: 0, left: 0 }} draggable={false} />
          </div>
          <div className="absolute inset-x-0 overflow-hidden" style={{ top: `${TEAR_Y}%`, height: `${100 - TEAR_Y}%`, animation: 'splitBottomBig 0.7s cubic-bezier(0.25,0.46,0.45,0.94) forwards' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={packSrc} alt="" className="w-full block" style={{ position: 'absolute', top: `-${(TEAR_Y / (100 - TEAR_Y)) * 100}%`, left: 0 }} draggable={false} />
          </div>
          <div className="absolute inset-x-0 bg-white pointer-events-none"
            style={{ top: `${TEAR_Y}%`, height: '2px', transform: 'translateY(-50%)', boxShadow: '0 0 20px 10px rgba(255,255,255,0.9)', animation: 'flashLine 0.7s ease-out forwards' }} />
        </div>
      )}

      {/* ── CARDS ── */}
      {phase === 'cards' && currentCard && (
        <div className="flex flex-col items-center gap-5 relative">

          {/* Indicateurs — neutres jusqu'au reveal de chaque carte */}
          <div className="flex items-center gap-1.5 z-10">
            {cards.map((c, i) => (
              <div key={i} className="rounded-full transition-all duration-300"
                style={{
                  width: i === cardIndex ? '20px' : '8px', height: '8px',
                  background: i < cardIndex
                    ? (RARITY_COLOR[cards[i].rarity] ?? '#fff')  // cartes déjà révélées = couleur
                    : i === cardIndex && cardPhase === 'revealed'
                      ? (RARITY_COLOR[cards[i].rarity] ?? '#fff') // carte actuelle révélée = couleur
                      : 'rgba(255,255,255,0.2)',                  // sinon neutre
                }} />
            ))}
          </div>

          {/* Zone FX (aura + rays + lightning canvas) */}
          <div className="relative" style={{ width: 'min(68vw, 260px)', aspectRatio: '0.714' }}>

          {/* Zone FX — fx-stage déborde de -35% comme l'ancien projet */}
          <div className="absolute pointer-events-none z-0" style={{ inset: '-35%' }}>

            {/* Aura — uniquement après reveal */}
            {auraColor && cardPhase === 'revealed' && (
              <div style={{
                position: 'absolute', left: '50%', top: '50%',
                width: '640px', height: '640px',
                transform: 'translate(-50%, -50%)',
                background: auraColor,
                borderRadius: '50%',
                filter: 'blur(52px)',
                animation: 'fxAura 1.4s ease-out forwards',
              }} />
            )}

            {/* Rays — uniquement après reveal */}
            {raysColor && cardPhase === 'revealed' && (
              <div style={{
                position: 'absolute', left: '50%', top: '50%',
                width: '780px', height: '780px',
                transform: 'translate(-50%, -50%)',
                background: raysColor,
                borderRadius: '50%',
                mixBlendMode: 'screen',
                animation: rarity === 'void' ? 'fxRaysMythic 2.0s ease-out forwards' : 'fxRays 1.6s ease-out forwards',
              }} />
            )}

            {/* Lightning canvas — invisible jusqu'au reveal */}
            <canvas ref={canvasRef} style={{
              position: 'absolute', left: '50%', top: '50%',
              width: '900px', height: '900px',
              transform: 'translate(-50%, -50%)',
              mixBlendMode: 'screen',
              opacity: 0,
              pointerEvents: 'none',
              visibility: cardPhase === 'revealed' ? 'visible' : 'hidden',
            }} />

            {/* Burst */}
            {auraColor && cardPhase === 'revealed' && (
              <div style={{
                position: 'absolute', left: '50%', top: '50%',
                width: '560px', height: '560px',
                transform: 'translate(-50%, -50%)',
                background: `radial-gradient(circle at center, ${hexToRgba(color, rarity === 'void' ? .58 : .42)}, ${hexToRgba(color, .18)} 34%, transparent 60%)`,
                borderRadius: '50%',
                mixBlendMode: 'screen',
                animation: rarity === 'void' ? 'fxBurstMythic 1.1s ease-out forwards' : 'fxBurst 0.9s ease-out forwards',
              }} />
            )}

            {/* Particules de rareté */}
            <div className="absolute inset-0 overflow-visible pointer-events-none" style={{ left: '35%', top: '35%', width: '30%', height: '30%' }}>
              {particles.map(p => (
                <div key={p.id} className="absolute rounded-full"
                  style={{
                    width: '8px', height: '8px',
                    background: p.color, left: `${p.x}%`, top: `${p.y}%`,
                    boxShadow: `0 0 16px ${p.color}`,
                    animation: 'fxParticleRise 1.2s ease-out forwards',
                    animationDuration: `${0.8 + Math.random() * 1.2}s`,
                  }} />
              ))}
            </div>
          </div>

            {/* Suspense overlay (tremblement) */}
            {cardPhase === 'suspense' && (
              <div className="absolute inset-0 rounded-2xl pointer-events-none z-30 animate-[cardPulse_0.4s_ease-in-out_infinite]"
                style={{ border: `2px solid ${hexToRgba(color, .4)}`, boxShadow: `0 0 30px ${hexToRgba(color, .3)}, inset 0 0 20px ${hexToRgba(color, .1)}` }} />
            )}

            {/* Carte flip 3D */}
            <div
              onClick={handleCardTap}
              className="absolute inset-0 cursor-pointer select-none z-20"
              style={{ perspective: '1000px' }}
            >
              <div className="w-full h-full relative transition-transform duration-[950ms]"
                style={{ transformStyle: 'preserve-3d', transform: cardPhase === 'revealed' ? 'rotateY(180deg)' : 'rotateY(0deg)', transitionTimingFunction: 'cubic-bezier(.16,.88,.18,1)' }}>

                {/* DOS */}
                <div className={cn('absolute inset-0 rounded-2xl overflow-hidden', cardPhase === 'suspense' && 'animate-[cardShake_0.15s_ease-in-out_infinite]')}
                  style={{ backfaceVisibility: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
                  <Image src="/assets/dos.png" alt="" fill className="object-cover" />
                </div>

                {/* FACE */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden bg-[#050210]"
                  style={{
                    backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
                    boxShadow: cardPhase === 'revealed'
                      ? `0 0 60px ${hexToRgba(color, .7)}, 0 0 120px ${hexToRgba(color, .35)}, 0 20px 60px rgba(0,0,0,0.8)`
                      : '0 20px 60px rgba(0,0,0,0.8)',
                    border: cardPhase === 'revealed'
                      ? `1px solid ${hexToRgba(color, .5)}`
                      : '1px solid rgba(255,255,255,0.1)',
                  }}>
                  {currentCard.artUrl
                    ? <Image src={currentCard.artUrl} alt={currentCard.name} fill className="object-contain" unoptimized />
                    : <div className="w-full h-full flex items-center justify-center">
                        <div className="w-20 h-20 rounded-full opacity-40" style={{ background: `radial-gradient(circle, ${color}, transparent)` }} />
                      </div>
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Nom + rareté sous la carte */}
          <div className={cn('flex flex-col items-center gap-0.5 transition-all duration-300 z-10', cardPhase === 'revealed' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2')}>
            <p className="text-white font-bold text-base">{currentCard.name}</p>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color }}>{currentCard.rarity}</p>
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
