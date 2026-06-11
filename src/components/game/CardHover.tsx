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

export function CardHover({ rarity, children, className = '', style = {} }: CardHoverProps) {
  const cardRef  = useRef<HTMLDivElement>(null)
  const glowRef  = useRef<HTMLDivElement>(null)
  const shimRef  = useRef<HTMLDivElement>(null)
  const rafRef   = useRef<number>(0)
  const starCanvasRef  = useRef<HTMLCanvasElement>(null)
  const emberCanvasRef = useRef<HTMLCanvasElement>(null)
  const [hovered, setHovered] = useState(false)

  const isVoid      = rarity === 'void'
  const isLegendary = rarity === 'legendary'

  // Void étoiles canvas
  useEffect(() => {
    if (!isVoid) return
    const canvas = starCanvasRef.current
    const card = cardRef.current
    if (!canvas || !card) return
    canvas.width = card.offsetWidth || 260
    canvas.height = card.offsetHeight || 365
    const ctx = canvas.getContext('2d')!
    const stars = Array.from({ length: 16 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: .6 + Math.random() * 1.8, phase: Math.random() * Math.PI * 2,
      speed: .007 + Math.random() * .013, vy: -.08 - Math.random() * .14,
    }))
    let t = 0, raf = 0
    function drawStar(x: number, y: number, r: number, a: number) {
      ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y)
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const ang = (i/8)*Math.PI*2; const len = i%2===0 ? r : r*.28
        i===0 ? ctx.moveTo(Math.cos(ang)*len,Math.sin(ang)*len) : ctx.lineTo(Math.cos(ang)*len,Math.sin(ang)*len)
      }
      ctx.closePath(); ctx.fillStyle='#e9d5ff'; ctx.shadowBlur=r*8; ctx.shadowColor='#a855f7'; ctx.fill()
      ctx.beginPath(); ctx.arc(0,0,r*.3,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.shadowBlur=r*4; ctx.fill()
      ctx.restore()
    }
    function frame() {
      t++; ctx.clearRect(0,0,canvas.width,canvas.height)
      for (const s of stars) {
        s.y += s.vy
        if (s.y < -8) { s.y = canvas.height+4; s.x = Math.random()*canvas.width }
        drawStar(s.x, s.y, s.r, .35+.55*Math.sin(t*s.speed+s.phase))
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [isVoid])

  // Legendary braises canvas
  useEffect(() => {
    if (!isLegendary || !hovered) return
    const canvas = emberCanvasRef.current
    const card = cardRef.current
    if (!canvas || !card) return
    canvas.width = card.offsetWidth || 260
    canvas.height = card.offsetHeight || 365
    const ctx = canvas.getContext('2d')!
    const colors = ['#ffd700','#ff8c00','#ffb347','#ffa500','#fffacd']
    type E = {x:number;y:number;vx:number;vy:number;r:number;life:number;decay:number;color:string;wobble:number}
    const embers: E[] = []
    let st=0, raf=0
    function frame() {
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
        ctx.save(); ctx.globalAlpha=e.life*.8; ctx.beginPath(); ctx.arc(e.x,e.y,r,0,Math.PI*2)
        ctx.fillStyle=e.color; ctx.shadowBlur=r*5; ctx.shadowColor='#ffd700'; ctx.fill(); ctx.restore()
      }
      raf = requestAnimationFrame(frame)
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
      card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.04)`

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
          : rarity === 'epic' ? 'rgba(200,150,255,0.28)'
          : 'rgba(147,210,255,0.25)'
        shimRef.current.style.background = `linear-gradient(105deg, transparent ${shimX - 15}%, ${color} ${shimX}%, transparent ${shimX + 15}%)`
        shimRef.current.style.opacity = '1'
      }
    })
  }, [rarity])

  const onLeave = useCallback(() => {
    setHovered(false)
    const card = cardRef.current
    if (!card) return
    card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)'
    card.style.transition = 'transform 0.4s ease'
    if (glowRef.current) glowRef.current.style.opacity = '0'
    if (shimRef.current) shimRef.current.style.opacity = '0'
    setTimeout(() => {
      if (card) card.style.transition = ''
    }, 400)
  }, [])

  const onEnter = useCallback(() => {
    setHovered(true)
    const card = cardRef.current
    if (card) card.style.transition = 'transform 0.1s ease'
  }, [])

  if (rarity === 'common') {
    return (
      <div ref={cardRef} className={className} style={{ ...style, transition: 'transform 0.1s ease' }}
        onMouseMove={onMove} onMouseLeave={onLeave} onMouseEnter={onEnter}>
        {children}
      </div>
    )
  }

  return (
    <div
      ref={cardRef}
      className={className}
      style={{ ...style, transformStyle: 'preserve-3d', willChange: 'transform' }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onMouseEnter={onEnter}
    >
      {children}

      {/* Glow overlay */}
      <div ref={glowRef} className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-150"
        style={{ opacity: 0, mixBlendMode: 'screen', zIndex: 2 }} />

      {/* Shimmer overlay */}
      {RARITY_SHIMMER[rarity] !== 'none' && (
        <div ref={shimRef} className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-100"
          style={{ opacity: 0, mixBlendMode: 'screen', zIndex: 3 }} />
      )}

      {/* Void : étoiles canvas */}
      {isVoid && (
        <canvas ref={starCanvasRef} className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{zIndex:4,width:'100%',height:'100%',mixBlendMode:'screen'}} />
      )}

      {/* Legendary : éclat doré aux coins */}
      {rarity === 'legendary' && (
        <>
          <div className="absolute top-0 left-0 w-8 h-8 pointer-events-none z-4"
            style={{ background: 'radial-gradient(circle at 0% 0%, rgba(255,215,0,0.4), transparent 70%)' }} />
          <div className="absolute top-0 right-0 w-8 h-8 pointer-events-none z-4"
            style={{ background: 'radial-gradient(circle at 100% 0%, rgba(255,215,0,0.4), transparent 70%)' }} />
          <div className="absolute bottom-0 left-0 w-8 h-8 pointer-events-none z-4"
            style={{ background: 'radial-gradient(circle at 0% 100%, rgba(255,215,0,0.3), transparent 70%)' }} />
          <div className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none z-4"
            style={{ background: 'radial-gradient(circle at 100% 100%, rgba(255,215,0,0.3), transparent 70%)' }} />
        </>
      )}

      {/* Legendary : braises canvas (hover only) */}
      {isLegendary && hovered && (
        <canvas ref={emberCanvasRef} className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{zIndex:4,width:'100%',height:'100%',mixBlendMode:'screen'}} />
      )}
    </div>
  )
}
