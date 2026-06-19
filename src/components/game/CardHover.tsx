'use client'
import { useRef, useCallback, useEffect, useState } from 'react'

interface CardHoverProps {
  rarity: string
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

const RARITY_GLOW: Record<string, string> = {
  void:      'rgba(168,85,247,0.8)',
  legendary: 'rgba(255,154,61,0.8)',
  epic:      'rgba(184,109,255,0.7)',
  rare:      'rgba(74,163,255,0.6)',
  common:    'rgba(255,255,255,0.15)',
}

const RARITY_SHIMMER: Record<string, string> = {
  void:      'linear-gradient(105deg, transparent 40%, rgba(168,85,247,0.25) 50%, transparent 60%)',
  legendary: 'linear-gradient(105deg, transparent 40%, rgba(255,215,0,0.30) 50%, transparent 60%)',
  epic:      'linear-gradient(105deg, transparent 40%, rgba(192,132,252,0.25) 50%, transparent 60%)',
  rare:      'linear-gradient(105deg, transparent 40%, rgba(147,210,255,0.25) 50%, transparent 60%)',
  common:    'none',
}

// ── Sprites de particules pré-rendus une seule fois (le glow est "cuit" dans une
//    image, puis on ne fait que drawImage → plus aucun shadowBlur par frame). ──
const STAR_BASE = 8
const STAR_SIZE = 160
const _starCache = new Map<string, HTMLCanvasElement>()
function starSprite(color: string): HTMLCanvasElement {
  let c = _starCache.get(color)
  if (c) return c
  c = document.createElement('canvas')
  c.width = c.height = STAR_SIZE
  const g = c.getContext('2d')!
  g.translate(STAR_SIZE / 2, STAR_SIZE / 2)
  g.fillStyle = color; g.shadowColor = color; g.shadowBlur = STAR_BASE * 8
  g.beginPath()
  for (let i = 0; i < 8; i++) {
    const ang = (i/8)*Math.PI*2; const len = i%2===0 ? STAR_BASE : STAR_BASE*.28
    i===0 ? g.moveTo(Math.cos(ang)*len, Math.sin(ang)*len) : g.lineTo(Math.cos(ang)*len, Math.sin(ang)*len)
  }
  g.closePath(); g.fill()
  g.fillStyle = '#fff'; g.shadowBlur = STAR_BASE * 4
  g.beginPath(); g.arc(0, 0, STAR_BASE*.3, 0, Math.PI*2); g.fill()
  _starCache.set(color, c)
  return c
}

const EMBER_BASE = 6
const EMBER_SIZE = 120
const _emberCache = new Map<string, HTMLCanvasElement>()
function emberSprite(color: string): HTMLCanvasElement {
  let c = _emberCache.get(color)
  if (c) return c
  c = document.createElement('canvas')
  c.width = c.height = EMBER_SIZE
  const g = c.getContext('2d')!
  g.translate(EMBER_SIZE / 2, EMBER_SIZE / 2)
  g.fillStyle = color; g.shadowColor = '#ffd700'; g.shadowBlur = EMBER_BASE * 5
  g.beginPath(); g.arc(0, 0, EMBER_BASE, 0, Math.PI*2); g.fill()
  _emberCache.set(color, c)
  return c
}

export function CardHover({ rarity, children, className = '', style = {} }: CardHoverProps) {
  const cardRef  = useRef<HTMLDivElement>(null)
  const glowRef  = useRef<HTMLDivElement>(null)
  const shimRef  = useRef<HTMLDivElement>(null)
  const holoRef  = useRef<HTMLDivElement>(null)
  const rafRef   = useRef<number>(0)
  const starCanvasRef  = useRef<HTMLCanvasElement>(null)
  const emberCanvasRef = useRef<HTMLCanvasElement>(null)
  const [hovered, setHovered] = useState(false)
  const hoveredRef = useRef(false)
  const tiltRef = useRef({ rx: 0, ry: 0, scale: 1 })
  const glowBehindRef = useRef<HTMLDivElement>(null)
  const floatRafRef = useRef<number>(0)

  // Optimisation transparente (rendu identique partout) : les animations sont
  // mises en pause quand la carte est hors de l'écran. Sur une grille, seules
  // les cartes visibles tournent — gros gain CPU sur PC comme sur mobile.
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = cardRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '120px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const heavyFx = inView

  const currentTiltRef = useRef({ rx: 0, ry: 0, scale: 1 })
  function applyTransform(card: HTMLDivElement, t: number) {
    const period = Math.PI * 2 / 6
    const floatY = Math.sin(t * period) * 7

    const cur = currentTiltRef.current
    const target = tiltRef.current
    cur.rx += (target.rx - cur.rx) * 0.15
    cur.ry += (target.ry - cur.ry) * 0.15
    cur.scale += (target.scale - cur.scale) * 0.15

    card.style.transform = `perspective(800px) translateY(${floatY}px) rotateX(${cur.rx}deg) rotateY(${cur.ry}deg) scale(${cur.scale})`
  }

  const isVoid      = rarity === 'void'
  const isLegendary = rarity === 'legendary'

  // ── Void : boucle continue — float + glow respirant + application du tilt ──
  useEffect(() => {
    if (!isVoid || !heavyFx) return
    const card = cardRef.current
    if (!card) return
    const cardEl: HTMLDivElement = card
    let raf = 0, t = 0
    function frame() {
      t += 0.016
      applyTransform(cardEl, t)
      if (glowBehindRef.current) {
        const breathe = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * (Math.PI * 2 / 4)))
        glowBehindRef.current.style.opacity = String(breathe)
        glowBehindRef.current.style.transform = `scale(${1 + breathe * 0.12})`
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [isVoid, heavyFx])

  // Void étoiles canvas
  useEffect(() => {
    if (!isVoid || !heavyFx) return
    const canvasEl = starCanvasRef.current
    const card = cardRef.current
    if (!canvasEl || !card) return
    const canvas: HTMLCanvasElement = canvasEl
    canvas.width = card.offsetWidth || 260
    canvas.height = card.offsetHeight || 365
    const ctx = canvas.getContext('2d')!
    const iridColors = ['#a855f7','#60a5fa','#f472b6','#34d399','#fbbf24','#c084fc']
    const stars = Array.from({ length: 28 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: 1 + Math.random() * 2.8, phase: Math.random() * Math.PI * 2,
      speed: .007 + Math.random() * .013, vy: -.1 - Math.random() * .18,
      color: iridColors[Math.floor(Math.random()*iridColors.length)],
    }))
    let t = 0, raf = 0, skip = 0
    function drawStar(x: number, y: number, r: number, a: number, color: string) {
      const sp = starSprite(color)
      const d = STAR_SIZE * (r / STAR_BASE)
      ctx.globalAlpha = a
      ctx.drawImage(sp, x - d/2, y - d/2, d, d)
    }
    function frame() {
      raf = requestAnimationFrame(frame)
      if (skip++ & 1) return
      t++; ctx.clearRect(0,0,canvas.width,canvas.height)
      const irid = hoveredRef.current
      for (const s of stars) {
        s.y += s.vy
        if (s.y < -8) { s.y = canvas.height+4; s.x = Math.random()*canvas.width }
        const alpha = .35+.55*Math.sin(t*s.speed+s.phase)
        drawStar(s.x, s.y, s.r, alpha, irid ? s.color : '#e9d5ff')
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [isVoid, heavyFx])

  // Legendary braises canvas
  useEffect(() => {
    if (!isLegendary || !hovered) return
    const canvasEl2 = emberCanvasRef.current
    const card = cardRef.current
    if (!canvasEl2 || !card) return
    const canvas: HTMLCanvasElement = canvasEl2
    canvas.width = card.offsetWidth || 260
    canvas.height = card.offsetHeight || 365
    const ctx = canvas.getContext('2d')!
    const colors = ['#ffd700','#ff8c00','#ffb347','#ffa500','#fffacd']
    type E = {x:number;y:number;vx:number;vy:number;r:number;life:number;decay:number;color:string;wobble:number}
    const embers: E[] = []
    let st=0, raf=0, skip=0
    function frame() {
      raf = requestAnimationFrame(frame)
      if (skip++ & 1) return
      ctx.clearRect(0,0,canvas.width,canvas.height); st++
      if (st%7===0 && embers.length<20) embers.push({
        x:canvas.width*(.15+Math.random()*.7), y:canvas.height*(.55+Math.random()*.4),
        vx:(Math.random()-.5)*.35, vy:-(.12+Math.random()*.35),
        r:.7+Math.random()*1.4, life:1, decay:.003+Math.random()*.004,
        color:colors[Math.floor(Math.random()*colors.length)], wobble:Math.random()*Math.PI*2,
      })
      for (let i=embers.length-1;i>=0;i--) {
        const e=embers[i]; e.wobble+=.03; e.x+=e.vx+Math.sin(e.wobble)*.2; e.y+=e.vy; e.life-=e.decay
        if(e.life<=0){embers.splice(i,1);continue}
        const r=Math.max(0,e.r*Math.sqrt(e.life))
        const sp=emberSprite(e.color); const d=EMBER_SIZE*(r/EMBER_BASE)
        ctx.globalAlpha=e.life*.8; ctx.drawImage(sp, e.x-d/2, e.y-d/2, d, d)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ctx.clearRect(0,0,canvas.width,canvas.height) }
  }, [isLegendary, hovered])

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current
    if (!card) return
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width   // 0..1
      const y = (e.clientY - rect.top)  / rect.height  // 0..1
      const rx = (y - 0.5) * (rarity === 'void' || rarity === 'legendary' ? 22 : rarity === 'epic' ? 18 : rarity === 'rare' ? 14 : 8)
      const ry = (x - 0.5) * -(rarity === 'void' || rarity === 'legendary' ? 22 : rarity === 'epic' ? 18 : rarity === 'rare' ? 14 : 8)
      tiltRef.current = { rx, ry, scale: 1.04 }
      if (!isVoid) {
        card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.04)`
      }

      // Glow suit le curseur
      if (glowRef.current) {
        glowRef.current.style.background = `radial-gradient(circle at ${x*100}% ${y*100}%, ${RARITY_GLOW[rarity] ?? RARITY_GLOW.common}, transparent 65%)`
        glowRef.current.style.opacity = '1'
      }

      // Shimmer suit le curseur
      if (shimRef.current && RARITY_SHIMMER[rarity] !== 'none') {
        const shimX = x * 100
        const color = rarity === 'legendary' ? 'rgba(255,215,0,0.35)'
          : rarity === 'void' ? 'rgba(192,132,252,0.30)'
          : rarity === 'epic' ? 'rgba(236,72,153,0.28)'
          : 'rgba(147,210,255,0.25)'
        shimRef.current.style.background = `linear-gradient(105deg, transparent ${shimX - 15}%, ${color} ${shimX}%, transparent ${shimX + 15}%)`
        shimRef.current.style.opacity = '1'
      }

      // Holo foil — void uniquement, dégradé arc-en-ciel qui suit le curseur
      if (isVoid && holoRef.current) {
        const hx = x * 100
        const hy = y * 100
        holoRef.current.style.background = `linear-gradient(${115 + (x-0.5)*60}deg,
          rgba(255,0,150,0) 0%,
          rgba(255,0,150,0.25) ${hx-25}%,
          rgba(255,200,0,0.25) ${hx-10}%,
          rgba(0,255,150,0.25) ${hx}%,
          rgba(0,180,255,0.25) ${hx+10}%,
          rgba(180,0,255,0.25) ${hx+25}%,
          rgba(255,0,150,0) 100%)`
        holoRef.current.style.opacity = '0.6'
        holoRef.current.style.backgroundPosition = `${hx}% ${hy}%`
      }
    })
  }, [rarity, isVoid])

  const onLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    setHovered(false)
    hoveredRef.current = false
    const card = cardRef.current
    if (!card) return
    tiltRef.current = { rx: 0, ry: 0, scale: 1 }
    if (!isVoid) {
      card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)'
      card.style.transition = 'transform 0.4s ease'
      setTimeout(() => { if (card) card.style.transition = '' }, 400)
    }
    if (glowRef.current) glowRef.current.style.opacity = '0'
    if (shimRef.current) shimRef.current.style.opacity = '0'
    if (holoRef.current) holoRef.current.style.opacity = '0'
  }, [isVoid, heavyFx])

  const onEnter = useCallback(() => {
    setHovered(true)
    hoveredRef.current = true
    const card = cardRef.current
    if (card && !isVoid) card.style.transition = 'transform 0.1s ease'
  }, [isVoid, heavyFx])

  if (rarity === 'common') {
    return (
      <div ref={cardRef} className={className} style={{ ...style, borderRadius: 12, transition: 'transform 0.1s ease' }}
        onMouseMove={onMove} onMouseLeave={onLeave} onMouseEnter={onEnter}>
        {children}
      </div>
    )
  }

  return (
    <div
      ref={cardRef}
      className={className}
      style={{ ...style, borderRadius: 12, willChange: 'transform', isolation: 'isolate' }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onMouseEnter={onEnter}
    >
      {children}

      {/* Glow overlay */}
      <div ref={glowRef} className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-150"
        style={{ opacity: 0, mixBlendMode: 'screen', zIndex: 2, borderRadius: 12 }} />

      {/* Shimmer overlay */}
      {RARITY_SHIMMER[rarity] !== 'none' && (
        <div ref={shimRef} className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-100"
          style={{ opacity: 0, mixBlendMode: 'screen', zIndex: 3, borderRadius: 12 }} />
      )}

      {/* Holo foil — void uniquement, effet holographique pleine carte */}
      {isVoid && (
        <div ref={holoRef} className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-150"
          style={{ opacity: 0, mixBlendMode: 'screen', zIndex: 3, borderRadius: 12 }} />
      )}

      {/* Void : glow respirant derrière — contrôlé par rAF */}
      {isVoid && (
        <div ref={glowBehindRef} className="absolute pointer-events-none"
          style={{
            inset: '-20%', borderRadius: '50%', zIndex: 0, filter: 'blur(22px)',
            background: 'radial-gradient(circle, rgba(168,85,247,.45) 0%, rgba(168,85,247,.15) 45%, transparent 70%)',
            opacity: 0.6,
          }} />
      )}

      {/* Void : étoiles canvas — visibles au hover, plus nombreuses */}
      {isVoid && (
        <canvas ref={starCanvasRef} className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-200"
          style={{zIndex:4,width:'100%',height:'100%',mixBlendMode:'screen', opacity: hovered ? 1 : 0.35, borderRadius: 12}} />
      )}

      {/* Legendary : éclat doré aux coins */}
      {rarity === 'legendary' && (
        <>
          <div className="absolute top-0 left-0 w-8 h-8 pointer-events-none z-4"
            style={{ background: 'radial-gradient(circle at 0% 0%, rgba(255,215,0,0.4), transparent 70%)', borderTopLeftRadius: 12 }} />
          <div className="absolute top-0 right-0 w-8 h-8 pointer-events-none z-4"
            style={{ background: 'radial-gradient(circle at 100% 0%, rgba(255,215,0,0.4), transparent 70%)', borderTopRightRadius: 12 }} />
          <div className="absolute bottom-0 left-0 w-8 h-8 pointer-events-none z-4"
            style={{ background: 'radial-gradient(circle at 0% 100%, rgba(255,215,0,0.3), transparent 70%)', borderBottomLeftRadius: 12 }} />
          <div className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none z-4"
            style={{ background: 'radial-gradient(circle at 100% 100%, rgba(255,215,0,0.3), transparent 70%)', borderBottomRightRadius: 12 }} />
        </>
      )}

      {/* Legendary : braises canvas (hover only) */}
      {isLegendary && hovered && (
        <canvas ref={emberCanvasRef} className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{zIndex:4,width:'100%',height:'100%',mixBlendMode:'screen',borderRadius:12}} />
      )}
    </div>
  )
}
