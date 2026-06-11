'use client'
import { useRef, useCallback, useEffect, useState } from 'react'

interface CardHoverProps {
  rarity: string
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

const TILT: Record<string, number> = {
  void: 26, legendary: 22, epic: 16, rare: 12, common: 6,
}
const GLOW_RGB: Record<string, string> = {
  void: '168,85,247', legendary: '255,170,50', epic: '184,109,255', rare: '74,163,255', common: '255,255,255',
}
const GLOW_ALPHA: Record<string, number> = {
  void: .7, legendary: .65, epic: .4, rare: .22, common: .08,
}
const SHIMMER: Record<string, { color: string; alpha: number }> = {
  void:      { color: '220,150,255', alpha: .45 },
  legendary: { color: '255,220,80',  alpha: .50 },
  epic:      { color: '200,140,255', alpha: .32 },
  rare:      { color: '140,200,255', alpha: .20 },
  common:    { color: '255,255,255', alpha: .06 },
}

export function CardHover({ rarity, children, className = '', style = {} }: CardHoverProps) {
  const wrapRef    = useRef<HTMLDivElement>(null) // conteneur externe — float ici
  const cardRef    = useRef<HTMLDivElement>(null) // conteneur tilt
  const glowBehindRef = useRef<HTMLDivElement>(null) // glow derrière (outside card)
  const glowRef    = useRef<HTMLDivElement>(null)
  const shimRef    = useRef<HTMLDivElement>(null)
  const borderRef  = useRef<HTMLDivElement>(null)
  const starCanvasRef = useRef<HTMLCanvasElement>(null)
  const emberCanvasRef = useRef<HTMLCanvasElement>(null)
  const tiltRafRef = useRef<number>(0)
  const breathRafRef = useRef<number>(0)
  const [hovered, setHovered] = useState(false)

  const isVoid      = rarity === 'void'
  const isLegendary = rarity === 'legendary'
  const maxTilt     = TILT[rarity] ?? TILT.common
  const glowRgb     = GLOW_RGB[rarity] ?? GLOW_RGB.common
  const glowAlpha   = GLOW_ALPHA[rarity] ?? .08
  const shimmer     = SHIMMER[rarity] ?? SHIMMER.common

  // ── Void : glow derrière qui respire (lentement) ──────────────────────────
  useEffect(() => {
    if (!isVoid) return
    const el = glowBehindRef.current
    if (!el) return
    let t = 0
    function frame() {
      t += .008 // très lent
      const alpha = .25 + .20 * Math.sin(t)
      const size  = 110 + 15 * Math.sin(t * .7)
      el!.style.background = `radial-gradient(circle at 50% 50%, rgba(${glowRgb},${alpha}) 0%, rgba(${glowRgb},${alpha*.4}) 40%, transparent 70%)`
      el!.style.width  = `${size}%`
      el!.style.height = `${size}%`
      el!.style.opacity = '1'
      breathRafRef.current = requestAnimationFrame(frame)
    }
    breathRafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(breathRafRef.current)
  }, [isVoid, glowRgb])

  // ── Void : étoiles canvas ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isVoid) return
    const canvas = starCanvasRef.current
    const card   = cardRef.current
    if (!canvas || !card) return

    const setSize = () => {
      const r = card.getBoundingClientRect()
      canvas.width  = r.width  || 260
      canvas.height = r.height || 365
    }
    setSize()

    const ctx = canvas.getContext('2d')!
    const stars = Array.from({ length: 16 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: .5 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
      speed: .006 + Math.random() * .012,
      vy: -.08 - Math.random() * .14,
    }))

    let t = 0
    let raf = 0
    function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(x, y)
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2
        const len   = i % 2 === 0 ? r : r * .28
        if (i === 0) ctx.moveTo(Math.cos(angle)*len, Math.sin(angle)*len)
        else         ctx.lineTo(Math.cos(angle)*len, Math.sin(angle)*len)
      }
      ctx.closePath()
      ctx.fillStyle = '#e9d5ff'
      ctx.shadowBlur = r * 8
      ctx.shadowColor = '#a855f7'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(0, 0, r * .3, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.restore()
    }
    function frame() {
      t++
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const s of stars) {
        s.y += s.vy
        if (s.y < -8) { s.y = canvas.height + 4; s.x = Math.random() * canvas.width }
        const alpha = .35 + .55 * Math.sin(t * s.speed + s.phase)
        drawStar(ctx, s.x, s.y, s.r, alpha)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [isVoid])

  // ── Legendary : braises canvas (hover only) ───────────────────────────────
  useEffect(() => {
    if (!isLegendary || !hovered) return
    const canvas = emberCanvasRef.current
    const card   = cardRef.current
    if (!canvas || !card) return

    const r = card.getBoundingClientRect()
    canvas.width  = r.width  || 260
    canvas.height = r.height || 365

    const ctx = canvas.getContext('2d')!
    const colors = ['#ffd700','#ff8c00','#ffb347','#ffa500','#fffacd']
    type Ember = { x:number; y:number; vx:number; vy:number; r:number; life:number; decay:number; color:string; wobble:number }
    const embers: Ember[] = []
    let spawnT = 0, raf = 0

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      spawnT++
      if (spawnT % 7 === 0 && embers.length < 20) {
        embers.push({
          x: canvas.width * (.15 + Math.random() * .7),
          y: canvas.height * (.55 + Math.random() * .4),
          vx: (Math.random() - .5) * .35,
          vy: -(.12 + Math.random() * .35),
          r: .7 + Math.random() * 1.4,
          life: 1,
          decay: .003 + Math.random() * .004,
          color: colors[Math.floor(Math.random() * colors.length)],
          wobble: Math.random() * Math.PI * 2,
        })
      }
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i]
        e.wobble += .03
        e.x += e.vx + Math.sin(e.wobble) * .2
        e.y += e.vy
        e.life -= e.decay
        if (e.life <= 0) { embers.splice(i, 1); continue }
        const radius = Math.max(0, e.r * Math.sqrt(e.life))
        ctx.save()
        ctx.globalAlpha = e.life * .8
        ctx.beginPath()
        ctx.arc(e.x, e.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = e.color
        ctx.shadowBlur = radius * 5
        ctx.shadowColor = '#ffd700'
        ctx.fill()
        ctx.restore()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ctx.clearRect(0, 0, canvas.width, canvas.height) }
  }, [isLegendary, hovered])

  // ── Tilt handlers ──────────────────────────────────────────────────────────
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current
    if (!card) return
    cancelAnimationFrame(tiltRafRef.current)
    tiltRafRef.current = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top)  / rect.height
      const rx =  (y - .5) * maxTilt
      const ry = -(x - .5) * maxTilt
      card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.04)`
      if (!isVoid && glowRef.current) {
        glowRef.current.style.background = `radial-gradient(circle at ${x*100}% ${y*100}%, rgba(${glowRgb},${glowAlpha}), rgba(${glowRgb},${glowAlpha*.4}) 40%, transparent 70%)`
        glowRef.current.style.opacity = '1'
      }
      if (shimRef.current) {
        const sx = x * 100
        shimRef.current.style.background = `linear-gradient(105deg, transparent ${sx-20}%, rgba(${shimmer.color},${shimmer.alpha}) ${sx}%, rgba(255,255,255,${shimmer.alpha*.4}) ${sx+5}%, transparent ${sx+22}%)`
        shimRef.current.style.opacity = '1'
      }
    })
  }, [maxTilt, glowRgb, glowAlpha, shimmer, isVoid])

  const onEnter = useCallback(() => {
    setHovered(true)
    if (cardRef.current) cardRef.current.style.transition = 'transform 0.08s ease'
    if (borderRef.current) borderRef.current.style.opacity = '1'
  }, [])

  const onLeave = useCallback(() => {
    setHovered(false)
    const card = cardRef.current
    if (!card) return
    card.style.transition = 'transform 0.5s ease'
    card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)'
    if (!isVoid && glowRef.current) glowRef.current.style.opacity = '0'
    if (shimRef.current) shimRef.current.style.opacity = '0'
    if (borderRef.current) borderRef.current.style.opacity = '0'
    setTimeout(() => { if (card) card.style.transition = '' }, 500)
  }, [isVoid])

  return (
    // Wrapper externe — float void ici, pas de overflow
    <div ref={wrapRef} className={className} style={{ ...style, position: 'relative' }}>

      {/* Glow derrière — void uniquement, centré, UNDER le card */}
      {isVoid && (
        <div ref={glowBehindRef}
          className="absolute pointer-events-none"
          style={{
            zIndex: 0,
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            filter: 'blur(28px)',
            transition: 'none',
          }} />
      )}

      {/* Card tilt container */}
      <div ref={cardRef}
        style={{ position: 'relative', transformStyle: 'preserve-3d', willChange: 'transform',
          width: '100%', height: '100%',
          animation: isVoid ? 'voidCardFloat 4s ease-in-out infinite' : 'none',
          zIndex: 1,
        }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onMouseEnter={onEnter}
      >
        {children}

        {/* Étoiles void — canvas par-dessus l'artwork */}
        {isVoid && (
          <canvas ref={starCanvasRef}
            className="absolute inset-0 pointer-events-none rounded-[inherit]"
            style={{ zIndex: 2, width: '100%', height: '100%', mixBlendMode: 'screen' }} />
        )}

        {/* Braises legendary — canvas par-dessus */}
        {isLegendary && hovered && (
          <canvas ref={emberCanvasRef}
            className="absolute inset-0 pointer-events-none rounded-[inherit]"
            style={{ zIndex: 2, width: '100%', height: '100%', mixBlendMode: 'screen' }} />
        )}

        {/* Glow cursor (non-void) */}
        {!isVoid && (
          <div ref={glowRef}
            className="absolute inset-0 pointer-events-none rounded-[inherit]"
            style={{ opacity: 0, mixBlendMode: 'screen', zIndex: 3 }} />
        )}

        {/* Shimmer */}
        <div ref={shimRef}
          className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{ opacity: 0, mixBlendMode: 'screen', zIndex: 4 }} />

        {/* Border glow */}
        {(rarity === 'legendary' || rarity === 'void' || rarity === 'epic') && (
          <div ref={borderRef}
            className="absolute inset-0 pointer-events-none rounded-[inherit]"
            style={{ opacity: isVoid ? .4 : 0, zIndex: 5,
              boxShadow: isVoid
                ? `0 0 20px rgba(${glowRgb},.4), 0 0 40px rgba(${glowRgb},.15), inset 0 0 0 1px rgba(${glowRgb},.4)`
                : isLegendary
                  ? `0 0 18px rgba(${glowRgb},.45), 0 0 36px rgba(${glowRgb},.18), inset 0 0 0 1px rgba(${glowRgb},.35)`
                  : `0 0 10px rgba(${glowRgb},.25), inset 0 0 0 1px rgba(${glowRgb},.2)`,
            }} />
        )}

        {/* Legendary coins */}
        {isLegendary && hovered && (
          [[0,0],[1,0],[0,1],[1,1]].map(([ix,iy], i) => (
            <div key={i} className="absolute w-16 h-16 pointer-events-none"
              style={{ zIndex: 5,
                left: ix ? 'auto' : 0, right: ix ? 0 : 'auto',
                top:  iy ? 'auto' : 0, bottom: iy ? 0 : 'auto',
                background: `radial-gradient(circle at ${ix?'100%':'0%'} ${iy?'100%':'0%'}, rgba(255,215,0,.5), rgba(255,165,0,.15) 50%, transparent 70%)`,
              }} />
          ))
        )}
      </div>
    </div>
  )
}
