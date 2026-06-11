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
  const cardRef        = useRef<HTMLDivElement>(null)
  const glowRef        = useRef<HTMLDivElement>(null)
  const shimRef        = useRef<HTMLDivElement>(null)
  const borderRef      = useRef<HTMLDivElement>(null)
  const starCanvasRef  = useRef<HTMLCanvasElement>(null)
  const emberCanvasRef = useRef<HTMLCanvasElement>(null)
  const tiltRafRef     = useRef<number>(0)
  const [hovered, setHovered] = useState(false)

  const isVoid      = rarity === 'void'
  const isLegendary = rarity === 'legendary'
  const maxTilt     = TILT[rarity]     ?? TILT.common
  const glowRgb     = GLOW_RGB[rarity] ?? GLOW_RGB.common
  const glowAlpha   = GLOW_ALPHA[rarity] ?? .08
  const shimmer     = SHIMMER[rarity]  ?? SHIMMER.common

  // ── Void float — sur le wrapper, pas sur la carte ─────────────────────────
  const floatWrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = floatWrapRef.current
    if (!el || !isVoid) return
    el.style.animation = 'voidCardFloat 4s ease-in-out infinite'
    return () => { if (el) el.style.animation = '' }
  }, [isVoid])

  // ── Void : étoiles canvas ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isVoid) return
    const canvas = starCanvasRef.current
    const card   = cardRef.current
    if (!canvas || !card) return

    const sync = () => {
      canvas.width  = card.offsetWidth  || 260
      canvas.height = card.offsetHeight || 365
    }
    sync()

    const ctx = canvas.getContext('2d')!
    const stars = Array.from({ length: 16 }, () => ({
      x: Math.random() * (canvas.width  || 260),
      y: Math.random() * (canvas.height || 365),
      r: .5 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      speed: .006 + Math.random() * .012,
      vy: -.07 - Math.random() * .12,
    }))

    let t = 0, raf = 0
    function drawStar(x: number, y: number, r: number, a: number) {
      ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y)
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const ang = (i/8)*Math.PI*2
        const len = i%2===0 ? r : r*.28
        i===0 ? ctx.moveTo(Math.cos(ang)*len,Math.sin(ang)*len)
              : ctx.lineTo(Math.cos(ang)*len,Math.sin(ang)*len)
      }
      ctx.closePath()
      ctx.fillStyle='#e9d5ff'; ctx.shadowBlur=r*8; ctx.shadowColor='#a855f7'; ctx.fill()
      ctx.beginPath(); ctx.arc(0,0,r*.3,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.shadowBlur=r*4; ctx.fill()
      ctx.restore()
    }

    function frame() {
      t++
      ctx.clearRect(0,0,canvas.width,canvas.height)
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

  // ── Legendary : braises (hover only) ─────────────────────────────────────
  useEffect(() => {
    if (!isLegendary || !hovered) return
    const canvas = emberCanvasRef.current
    const card   = cardRef.current
    if (!canvas || !card) return

    canvas.width  = card.offsetWidth  || 260
    canvas.height = card.offsetHeight || 365

    const ctx = canvas.getContext('2d')!
    const colors = ['#ffd700','#ff8c00','#ffb347','#ffa500','#fffacd']
    type E = {x:number;y:number;vx:number;vy:number;r:number;life:number;decay:number;color:string;wobble:number}
    const embers: E[] = []
    let st=0, raf=0

    function frame() {
      ctx.clearRect(0,0,canvas.width,canvas.height); st++
      if (st%7===0 && embers.length<20) embers.push({
        x: canvas.width*(.15+Math.random()*.7),
        y: canvas.height*(.55+Math.random()*.4),
        vx: (Math.random()-.5)*.35,
        vy: -(.12+Math.random()*.35),
        r: .7+Math.random()*1.4, life:1,
        decay: .003+Math.random()*.004,
        color: colors[Math.floor(Math.random()*colors.length)],
        wobble: Math.random()*Math.PI*2,
      })
      for (let i=embers.length-1;i>=0;i--) {
        const e=embers[i]
        e.wobble+=.03; e.x+=e.vx+Math.sin(e.wobble)*.2; e.y+=e.vy; e.life-=e.decay
        if (e.life<=0){embers.splice(i,1);continue}
        const r=Math.max(0,e.r*Math.sqrt(e.life))
        ctx.save(); ctx.globalAlpha=e.life*.8
        ctx.beginPath(); ctx.arc(e.x,e.y,r,0,Math.PI*2)
        ctx.fillStyle=e.color; ctx.shadowBlur=r*5; ctx.shadowColor='#ffd700'; ctx.fill()
        ctx.restore()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ctx.clearRect(0,0,canvas.width,canvas.height) }
  }, [isLegendary, hovered])

  // ── Tilt ───────────────────────────────────────────────────────────────────
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current; if (!card) return
    cancelAnimationFrame(tiltRafRef.current)
    tiltRafRef.current = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect()
      const x = (e.clientX-rect.left)/rect.width
      const y = (e.clientY-rect.top)/rect.height
      card.style.transform = `perspective(900px) rotateX(${(y-.5)*maxTilt}deg) rotateY(${-(x-.5)*maxTilt}deg) scale(1.04)`
      if (!isVoid && glowRef.current) {
        glowRef.current.style.background = `radial-gradient(circle at ${x*100}% ${y*100}%,rgba(${glowRgb},${glowAlpha}),rgba(${glowRgb},${glowAlpha*.4}) 40%,transparent 70%)`
        glowRef.current.style.opacity = '1'
      }
      if (shimRef.current) {
        const sx = x*100
        shimRef.current.style.background = `linear-gradient(105deg,transparent ${sx-20}%,rgba(${shimmer.color},${shimmer.alpha}) ${sx}%,rgba(255,255,255,${shimmer.alpha*.4}) ${sx+5}%,transparent ${sx+22}%)`
        shimRef.current.style.opacity = '1'
      }
    })
  },[maxTilt,glowRgb,glowAlpha,shimmer,isVoid])

  const onEnter = useCallback(() => {
    setHovered(true)
    const card = cardRef.current; if (!card) return
    card.style.transition = 'transform 0.08s ease'
    if (borderRef.current) borderRef.current.style.opacity = '1'
  },[])

  const onLeave = useCallback(() => {
    setHovered(false)
    const card = cardRef.current; if (!card) return
    card.style.transition = 'transform 0.5s ease'
    card.style.transform  = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)'
    if (!isVoid && glowRef.current)  glowRef.current.style.opacity  = '0'
    if (shimRef.current)              shimRef.current.style.opacity   = '0'
    if (!isVoid && borderRef.current) borderRef.current.style.opacity = '0'
    setTimeout(() => { if (card) card.style.transition = '' }, 500)

  return (
    <div
      ref={cardRef}
      className={className}
      style={{ ...style, position:'relative', transformStyle:'preserve-3d', willChange:'transform' }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onMouseEnter={onEnter}
    >
      {/* Glow derrière void */}
      {isVoid && (
        <div className="absolute pointer-events-none"
          style={{ inset:'-25%', borderRadius:'50%',
            background:`radial-gradient(circle,rgba(${glowRgb},.28) 0%,rgba(${glowRgb},.10) 45%,transparent 70%)`,
            filter:'blur(24px)', zIndex:0, animation:'voidGlowBreathe 4s ease-in-out infinite' }} />
      )}

      {children}

      {isVoid && (
        <canvas ref={starCanvasRef} className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{zIndex:2,width:'100%',height:'100%',mixBlendMode:'screen'}} />
      )}
      {isLegendary && hovered && (
        <canvas ref={emberCanvasRef} className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{zIndex:2,width:'100%',height:'100%',mixBlendMode:'screen'}} />
      )}
      {!isVoid && (
        <div ref={glowRef} className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{opacity:0,mixBlendMode:'screen',zIndex:3}} />
      )}
      <div ref={shimRef} className="absolute inset-0 pointer-events-none rounded-[inherit]"
        style={{opacity:0,mixBlendMode:'screen',zIndex:4}} />
      {(rarity==='legendary'||rarity==='void'||rarity==='epic') && (
        <div ref={borderRef} className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{ opacity:isVoid?.4:0, zIndex:5,
            boxShadow:isVoid
              ?`0 0 20px rgba(${glowRgb},.4),0 0 40px rgba(${glowRgb},.15),inset 0 0 0 1px rgba(${glowRgb},.4)`
              :isLegendary
                ?`0 0 18px rgba(${glowRgb},.45),0 0 36px rgba(${glowRgb},.18),inset 0 0 0 1px rgba(${glowRgb},.35)`
                :`0 0 10px rgba(${glowRgb},.25),inset 0 0 0 1px rgba(${glowRgb},.2)` }} />
      )}
      {isLegendary && hovered && [[0,0],[1,0],[0,1],[1,1]].map(([ix,iy],i) => (
        <div key={i} className="absolute w-16 h-16 pointer-events-none"
          style={{zIndex:5, left:ix?'auto':0, right:ix?0:'auto', top:iy?'auto':0, bottom:iy?0:'auto',
            background:`radial-gradient(circle at ${ix?'100%':'0%'} ${iy?'100%':'0%'},rgba(255,215,0,.5),rgba(255,165,0,.15) 50%,transparent 70%)`}} />
      ))}
    </div>
  )
}
