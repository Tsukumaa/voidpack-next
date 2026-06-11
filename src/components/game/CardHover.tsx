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

// ── Particules canvas void (étoiles scintillantes) ────────────────────────────
function useVoidParticles(canvasRef: React.RefObject<HTMLCanvasElement>, active: boolean) {
  const rafRef = useRef<number>(0)
  const pts = useRef<{ x:number; y:number; r:number; phase:number; speed:number; twinkle:number }[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    canvas.width  = rect.width
    canvas.height = rect.height
    pts.current = Array.from({ length: 22 }, () => ({
      x: Math.random() * rect.width,
      y: Math.random() * rect.height,
      r: .8 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
      speed: .02 + Math.random() * .04,
      twinkle: .4 + Math.random() * .6,
    }))
  }, [canvasRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let t = 0

    function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
      // Étoile à 4 branches
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(x, y)
      ctx.fillStyle = '#e9d5ff'
      ctx.shadowBlur = r * 6
      ctx.shadowColor = '#a855f7'
      ctx.beginPath()
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2
        const inner = r * .25
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r)
        ctx.lineTo(Math.cos(angle + Math.PI/4) * inner, Math.sin(angle + Math.PI/4) * inner)
      }
      ctx.closePath()
      ctx.fill()
      // Halo central
      ctx.beginPath()
      ctx.arc(0, 0, r * .4, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.shadowBlur = r * 3
      ctx.fill()
      ctx.restore()
    }

    function frame() {
      if (!active) { ctx.clearRect(0, 0, canvas.width, canvas.height); return }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      t += 1
      for (const p of pts.current) {
        p.y -= .3
        if (p.y < -10) p.y = canvas.height + 5
        const alpha = p.twinkle * (.5 + .5 * Math.sin(t * p.speed + p.phase))
        drawStar(ctx, p.x, p.y, p.r, alpha)
      }
      rafRef.current = requestAnimationFrame(frame)
    }

    if (active) {
      rafRef.current = requestAnimationFrame(frame)
    } else {
      cancelAnimationFrame(rafRef.current)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, canvasRef])
}

// ── Particules canvas legendary (braises / poussière dorée) ───────────────────
function useLegendaryParticles(canvasRef: React.RefObject<HTMLCanvasElement>, active: boolean) {
  const rafRef = useRef<number>(0)
  const pts = useRef<{ x:number; y:number; vx:number; vy:number; r:number; life:number; maxLife:number; color:string }[]>([])
  const spawnTimer = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    canvas.width  = rect.width
    canvas.height = rect.height
  }, [canvasRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const colors = ['#ffd700','#ff8c00','#ffec8b','#ffa500','#fff8dc']

    function spawn() {
      pts.current.push({
        x: canvas.width * (.1 + Math.random() * .8),
        y: canvas.height * (.6 + Math.random() * .4),
        vx: (Math.random() - .5) * 1.2,
        vy: -(.5 + Math.random() * 1.5),
        r: .8 + Math.random() * 2,
        life: 1,
        maxLife: 60 + Math.random() * 60,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }

    function frame() {
      if (!active) { ctx.clearRect(0, 0, canvas.width, canvas.height); pts.current = []; return }
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Spawn périodique
      spawnTimer.current++
      if (spawnTimer.current % 3 === 0) spawn()
      if (pts.current.length > 40) pts.current.splice(0, 5)

      for (let i = pts.current.length - 1; i >= 0; i--) {
        const p = pts.current[i]
        p.x  += p.vx + Math.sin(Date.now() * .002 + i) * .3
        p.y  += p.vy
        p.vy *= .99
        p.life -= 1 / p.maxLife
        if (p.life <= 0) { pts.current.splice(i, 1); continue }

        const alpha = p.life * .9
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.shadowBlur = p.r * 5
        ctx.shadowColor = '#ffd700'
        ctx.fill()
        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    if (active) {
      rafRef.current = requestAnimationFrame(frame)
    } else {
      cancelAnimationFrame(rafRef.current)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pts.current = []
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, canvasRef])
}

// ── Composant principal ───────────────────────────────────────────────────────
export function CardHover({ rarity, children, className = '', style = {} }: CardHoverProps) {
  const cardRef    = useRef<HTMLDivElement>(null)
  const glowRef    = useRef<HTMLDivElement>(null)
  const shimRef    = useRef<HTMLDivElement>(null)
  const borderRef  = useRef<HTMLDivElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const rafRef     = useRef<number>(0)
  const [hovered, setHovered] = useHoverState()

  const maxTilt   = TILT[rarity] ?? TILT.common
  const glowRgb   = GLOW[rarity] ?? GLOW.common
  const glowAlpha = GLOW_ALPHA[rarity] ?? .10
  const shimmer   = SHIMMER[rarity] ?? SHIMMER.common

  const isVoid      = rarity === 'void'
  const isLegendary = rarity === 'legendary'

  useVoidParticles(canvasRef as React.RefObject<HTMLCanvasElement>, isVoid && hovered)
  useLegendaryParticles(canvasRef as React.RefObject<HTMLCanvasElement>, isLegendary && hovered)

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

      if (glowRef.current) {
        glowRef.current.style.background = `radial-gradient(circle at ${x*100}% ${y*100}%, rgba(${glowRgb},${glowAlpha}), rgba(${glowRgb},${glowAlpha*.4}) 40%, transparent 70%)`
        glowRef.current.style.opacity = '1'
      }
      if (shimRef.current) {
        const sx = x * 100
        shimRef.current.style.background = `linear-gradient(105deg, transparent ${sx-20}%, rgba(${shimmer.color},${shimmer.alpha}) ${sx}%, rgba(255,255,255,${shimmer.alpha*.5}) ${sx+5}%, transparent ${sx+22}%)`
        shimRef.current.style.opacity = '1'
      }
    })
  }, [maxTilt, glowRgb, glowAlpha, shimmer])

  const onEnter = useCallback(() => {
    setHovered(true)
    if (cardRef.current) cardRef.current.style.transition = 'transform 0.08s ease'
    if (borderRef.current) borderRef.current.style.opacity = '1'
  }, [setHovered])

  const onLeave = useCallback(() => {
    setHovered(false)
    const card = cardRef.current
    if (!card) return
    card.style.transition = 'transform 0.5s ease'
    card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)'
    if (glowRef.current) glowRef.current.style.opacity = '0'
    if (shimRef.current) shimRef.current.style.opacity = '0'
    if (borderRef.current) borderRef.current.style.opacity = '0'
    setTimeout(() => { if (card) card.style.transition = '' }, 500)
  }, [setHovered])

  return (
    <div ref={cardRef} className={className}
      style={{ ...style, transformStyle:'preserve-3d', willChange:'transform', position:'relative' }}
      onMouseMove={onMove} onMouseLeave={onLeave} onMouseEnter={onEnter}>
      {children}

      {/* Glow */}
      <div ref={glowRef} className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-150"
        style={{ opacity:0, mixBlendMode:'screen', zIndex:2 }} />

      {/* Shimmer */}
      <div ref={shimRef} className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-100"
        style={{ opacity:0, mixBlendMode:'screen', zIndex:3 }} />

      {/* Border glow epic+ */}
      {(rarity === 'legendary' || rarity === 'void' || rarity === 'epic') && (
        <div ref={borderRef} className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-200"
          style={{ opacity:0, zIndex:4,
            boxShadow: isVoid
              ? `0 0 25px rgba(${glowRgb},.6),0 0 50px rgba(${glowRgb},.25),inset 0 0 0 1px rgba(${glowRgb},.5)`
              : isLegendary
                ? `0 0 20px rgba(${glowRgb},.5),0 0 40px rgba(${glowRgb},.2),inset 0 0 0 1px rgba(${glowRgb},.4)`
                : `0 0 12px rgba(${glowRgb},.3),inset 0 0 0 1px rgba(${glowRgb},.25)` }} />
      )}

      {/* Legendary : coins dorés */}
      {isLegendary && (
        [['0%','0%',0],[`100%`,'0%',1],['0%','100%',2],['100%','100%',3]].map(([l,t,i]) => (
          <div key={i as number} className="absolute w-16 h-16 pointer-events-none" style={{ left:l as string, top:t as string, zIndex:4,
            background:`radial-gradient(circle at ${(i as number)%2===0?'0%':'100%'} ${(i as number)<2?'0%':'100%'}, rgba(255,215,0,.55), rgba(255,165,0,.2) 40%, transparent 70%)` }} />
        ))
      )}

      {/* Canvas particules void / legendary */}
      {(isVoid || isLegendary) && hovered && (
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{ zIndex:5, width:'100%', height:'100%', mixBlendMode: isVoid ? 'screen' : 'screen' }} />
      )}
    </div>
  )
}

// Hook local simple pour déclencher re-render sur hover
function useHoverState(): [boolean, (v: boolean) => void] {
  const [h, setH] = useState(false)
  return [h, setH]
}
