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
const GLOW: Record<string, string> = {
  void: '168,85,247', legendary: '255,170,50', epic: '184,109,255', rare: '74,163,255', common: '255,255,255',
}
const GLOW_ALPHA: Record<string, number> = {
  void: .75, legendary: .70, epic: .45, rare: .25, common: .10,
}
const SHIMMER: Record<string, { color: string; alpha: number }> = {
  void:      { color: '220,150,255', alpha: .50 },
  legendary: { color: '255,220,80',  alpha: .55 },
  epic:      { color: '200,140,255', alpha: .35 },
  rare:      { color: '140,200,255', alpha: .22 },
  common:    { color: '255,255,255', alpha: .08 },
}

export function CardHover({ rarity, children, className = '', style = {} }: CardHoverProps) {
  const cardRef   = useRef<HTMLDivElement>(null)
  const glowRef   = useRef<HTMLDivElement>(null)
  const shimRef   = useRef<HTMLDivElement>(null)
  const borderRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const particleRafRef = useRef<number>(0)
  const [hovered, setHovered] = useState(false)

  const isVoid      = rarity === 'void'
  const isLegendary = rarity === 'legendary'
  const maxTilt     = TILT[rarity] ?? TILT.common
  const glowRgb     = GLOW[rarity] ?? GLOW.common
  const glowAlpha   = GLOW_ALPHA[rarity] ?? .10
  const shimmer     = SHIMMER[rarity] ?? SHIMMER.common

  // ── Void : étoiles toujours actives + glow respirant ──────────────────────
  useEffect(() => {
    if (!isVoid) return
    const canvas = canvasRef.current
    const card   = cardRef.current
    const glow   = glowRef.current
    if (!canvas || !card) return

    const resize = () => {
      const r = card.getBoundingClientRect()
      canvas.width  = r.width
      canvas.height = r.height
    }
    resize()

    const ctx = canvas.getContext('2d')!
    const stars = Array.from({ length: 18 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: .6 + Math.random() * 1.8,
      phase: Math.random() * Math.PI * 2,
      speed: .008 + Math.random() * .015,
      vy: -.12 - Math.random() * .18,
      vx: (Math.random() - .5) * .08,
    }))

    let t = 0
    function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(x, y)
      // 4 branches
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2
        const len   = i % 2 === 0 ? r : r * .3
        if (i === 0) ctx.moveTo(Math.cos(angle) * len, Math.sin(angle) * len)
        else ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len)
      }
      ctx.closePath()
      ctx.fillStyle = '#e9d5ff'
      ctx.shadowBlur = r * 8
      ctx.shadowColor = '#a855f7'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(0, 0, r * .35, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.shadowBlur = r * 4
      ctx.fill()
      ctx.restore()
    }

    function frame() {
      t++
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const s of stars) {
        s.x += s.vx
        s.y += s.vy
        if (s.y < -10) { s.y = canvas.height + 5; s.x = Math.random() * canvas.width }
        const alpha = .4 + .6 * Math.sin(t * s.speed + s.phase)
        drawStar(ctx, s.x, s.y, s.r, alpha * .85)
      }
      // Glow respirant
      if (glow) {
        const breath = .4 + .35 * Math.sin(t * .025)
        glow.style.background = `radial-gradient(circle at 50% 50%, rgba(${glowRgb},${breath * .55}) 0%, rgba(${glowRgb},${breath * .2}) 45%, transparent 72%)`
        glow.style.opacity = '1'
      }
      particleRafRef.current = requestAnimationFrame(frame)
    }
    particleRafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(particleRafRef.current)
  }, [isVoid, glowRgb])

  // ── Legendary : braises lentes organiques ─────────────────────────────────
  useEffect(() => {
    if (!isLegendary || !hovered) return
    const canvas = canvasRef.current
    const card   = cardRef.current
    if (!canvas || !card) return

    const r = card.getBoundingClientRect()
    canvas.width  = r.width
    canvas.height = r.height

    const ctx = canvas.getContext('2d')!
    const colors = ['#ffd700','#ff8c00','#ffb347','#ffa500','#fffacd','#ff6600']
    const embers: {
      x:number; y:number; vx:number; vy:number
      r:number; life:number; decay:number; color:string; wobble:number
    }[] = []

    let spawnT = 0

    function spawn() {
      embers.push({
        x: r.width * (.15 + Math.random() * .7),
        y: r.height * (.5 + Math.random() * .45),
        vx: (Math.random() - .5) * .4,
        vy: -(.15 + Math.random() * .45), // très lent
        r: .8 + Math.random() * 1.6,
        life: 1,
        decay: .004 + Math.random() * .005, // longue durée de vie
        color: colors[Math.floor(Math.random() * colors.length)],
        wobble: Math.random() * Math.PI * 2,
      })
    }

    function frame() {
      ctx.clearRect(0, 0, r.width, r.height)
      spawnT++
      if (spawnT % 5 === 0 && embers.length < 25) spawn() // spawn lent

      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i]
        e.wobble += .04
        e.x += e.vx + Math.sin(e.wobble) * .25 // dérive organique
        e.y += e.vy
        e.vy *= .995
        e.life -= e.decay
        if (e.life <= 0) { embers.splice(i, 1); continue }
        const radius = Math.max(0, e.r * Math.sqrt(e.life))
        ctx.save()
        ctx.globalAlpha = e.life * .85
        ctx.beginPath()
        ctx.arc(e.x, e.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = e.color
        ctx.shadowBlur = radius * 6
        ctx.shadowColor = '#ffd700'
        ctx.fill()
        ctx.restore()
      }
      particleRafRef.current = requestAnimationFrame(frame)
    }
    particleRafRef.current = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(particleRafRef.current)
      ctx.clearRect(0, 0, r.width, r.height)
    }
  }, [isLegendary, hovered])

  // ── Float void (animation CSS) ─────────────────────────────────────────────
  useEffect(() => {
    const card = cardRef.current
    if (!card || !isVoid) return
    card.style.animation = 'voidCardFloat 3s ease-in-out infinite'
    return () => { card.style.animation = '' }
  }, [isVoid])

  // ── Tilt handlers ──────────────────────────────────────────────────────────
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current
    if (!card) return
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
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
        shimRef.current.style.background = `linear-gradient(105deg, transparent ${sx-20}%, rgba(${shimmer.color},${shimmer.alpha}) ${sx}%, rgba(255,255,255,${shimmer.alpha*.5}) ${sx+5}%, transparent ${sx+22}%)`
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
    card.style.transform = isVoid
      ? 'perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)'
      : 'perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)'
    if (!isVoid && glowRef.current) glowRef.current.style.opacity = '0'
    if (shimRef.current) shimRef.current.style.opacity = '0'
    if (borderRef.current) borderRef.current.style.opacity = '0'
    setTimeout(() => {
      if (card) {
        card.style.transition = ''
        if (isVoid) card.style.animation = 'voidCardFloat 3s ease-in-out infinite'
      }
    }, 500)
  }, [isVoid])

  return (
    <div ref={cardRef} className={className}
      style={{ ...style, transformStyle:'preserve-3d', willChange:'transform', position:'relative' }}
      onMouseMove={onMove} onMouseLeave={onLeave} onMouseEnter={onEnter}>
      {children}

      {/* Canvas particules — void always on, legendary on hover */}
      {(isVoid || (isLegendary && hovered)) && (
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{ zIndex:5, width:'100%', height:'100%', mixBlendMode:'screen' }} />
      )}

      {/* Glow — void géré par canvas, autres par mouse */}
      <div ref={glowRef} className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-300"
        style={{ opacity: isVoid ? 1 : 0, zIndex:2 }} />

      {/* Shimmer */}
      <div ref={shimRef} className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-100"
        style={{ opacity:0, mixBlendMode:'screen', zIndex:3 }} />

      {/* Border glow epic+ */}
      {(rarity === 'legendary' || rarity === 'void' || rarity === 'epic') && (
        <div ref={borderRef} className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-200"
          style={{ opacity: isVoid ? .5 : 0, zIndex:4,
            boxShadow: isVoid
              ? `0 0 25px rgba(${glowRgb},.5),0 0 50px rgba(${glowRgb},.2),inset 0 0 0 1px rgba(${glowRgb},.45)`
              : isLegendary
                ? `0 0 20px rgba(${glowRgb},.5),0 0 40px rgba(${glowRgb},.2),inset 0 0 0 1px rgba(${glowRgb},.4)`
                : `0 0 12px rgba(${glowRgb},.3),inset 0 0 0 1px rgba(${glowRgb},.25)` }} />
      )}

      {/* Legendary coins */}
      {isLegendary && hovered && (
        [[0,0],[1,0],[0,1],[1,1]].map(([ix,iy], i) => (
          <div key={i} className="absolute w-16 h-16 pointer-events-none" style={{ zIndex:4,
            left: ix ? 'auto' : 0, right: ix ? 0 : 'auto',
            top:  iy ? 'auto' : 0, bottom: iy ? 0 : 'auto',
            background:`radial-gradient(circle at ${ix?'100%':'0%'} ${iy?'100%':'0%'}, rgba(255,215,0,.5), rgba(255,165,0,.15) 50%, transparent 70%)` }} />
        ))
      )}
    </div>
  )
}
