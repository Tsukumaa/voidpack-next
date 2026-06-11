'use client'
import { useRef, useCallback } from 'react'

interface CardHoverProps {
  rarity: string
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

// Intensité du tilt par rareté
const TILT: Record<string, number> = {
  void: 26, legendary: 22, epic: 16, rare: 12, common: 6,
}

// Glow color
const GLOW: Record<string, string> = {
  void:      '168,85,247',
  legendary: '255,170,50',
  epic:      '184,109,255',
  rare:      '74,163,255',
  common:    '255,255,255',
}

// Opacité du glow (0-1)
const GLOW_ALPHA: Record<string, number> = {
  void: .75, legendary: .70, epic: .45, rare: .25, common: .10,
}

// Shimmer color + intensité
const SHIMMER: Record<string, { color: string; alpha: number }> = {
  void:      { color: '220,150,255', alpha: .50 },
  legendary: { color: '255,220,80',  alpha: .55 },
  epic:      { color: '200,140,255', alpha: .35 },
  rare:      { color: '140,200,255', alpha: .22 },
  common:    { color: '255,255,255', alpha: .08 },
}

export function CardHover({ rarity, children, className = '', style = {} }: CardHoverProps) {
  const cardRef  = useRef<HTMLDivElement>(null)
  const glowRef  = useRef<HTMLDivElement>(null)
  const shimRef  = useRef<HTMLDivElement>(null)
  const borderRef = useRef<HTMLDivElement>(null)
  const rafRef   = useRef<number>(0)

  const maxTilt   = TILT[rarity] ?? TILT.common
  const glowRgb   = GLOW[rarity] ?? GLOW.common
  const glowAlpha = GLOW_ALPHA[rarity] ?? .10
  const shimmer   = SHIMMER[rarity] ?? SHIMMER.common

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

      // Glow suit le curseur
      if (glowRef.current) {
        glowRef.current.style.background =
          `radial-gradient(circle at ${x*100}% ${y*100}%, rgba(${glowRgb},${glowAlpha}) 0%, rgba(${glowRgb},${glowAlpha*.4}) 40%, transparent 70%)`
        glowRef.current.style.opacity = '1'
      }

      // Shimmer suit le curseur horizontalement
      if (shimRef.current) {
        const sx = x * 100
        shimRef.current.style.background =
          `linear-gradient(105deg, transparent ${sx-20}%, rgba(${shimmer.color},${shimmer.alpha}) ${sx}%, rgba(255,255,255,${shimmer.alpha*.5}) ${sx+5}%, transparent ${sx+22}%)`
        shimRef.current.style.opacity = '1'
      }
    })
  }, [maxTilt, glowRgb, glowAlpha, shimmer])

  const onEnter = useCallback(() => {
    if (cardRef.current) cardRef.current.style.transition = 'transform 0.08s ease'
    if (borderRef.current) borderRef.current.style.opacity = '1'
  }, [])

  const onLeave = useCallback(() => {
    const card = cardRef.current
    if (!card) return
    card.style.transition = 'transform 0.5s ease'
    card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)'
    if (glowRef.current) glowRef.current.style.opacity = '0'
    if (shimRef.current) shimRef.current.style.opacity = '0'
    if (borderRef.current) borderRef.current.style.opacity = '0'
    setTimeout(() => { if (card) card.style.transition = '' }, 500)
  }, [])

  return (
    <div
      ref={cardRef}
      className={className}
      style={{ ...style, transformStyle: 'preserve-3d', willChange: 'transform', position: 'relative' }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onMouseEnter={onEnter}
    >
      {children}

      {/* Glow overlay — intensité proportionnelle à la rareté */}
      <div ref={glowRef}
        className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-150"
        style={{ opacity: 0, mixBlendMode: 'screen', zIndex: 2 }} />

      {/* Shimmer overlay */}
      <div ref={shimRef}
        className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-100"
        style={{ opacity: 0, mixBlendMode: 'screen', zIndex: 3 }} />

      {/* Border glow — uniquement legendary+ */}
      {(rarity === 'legendary' || rarity === 'void' || rarity === 'epic') && (
        <div ref={borderRef}
          className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-200"
          style={{
            opacity: 0, zIndex: 4,
            boxShadow: rarity === 'void'
              ? `0 0 25px rgba(${glowRgb},.6), 0 0 50px rgba(${glowRgb},.25), inset 0 0 0 1px rgba(${glowRgb},.5)`
              : rarity === 'legendary'
                ? `0 0 20px rgba(${glowRgb},.5), 0 0 40px rgba(${glowRgb},.2), inset 0 0 0 1px rgba(${glowRgb},.4)`
                : `0 0 12px rgba(${glowRgb},.3), inset 0 0 0 1px rgba(${glowRgb},.25)`,
          }} />
      )}

      {/* Legendary : coins dorés */}
      {rarity === 'legendary' && (
        <>
          {[['0%','0%'],['100%','0%'],['0%','100%'],['100%','100%']].map(([l,t], i) => (
            <div key={i} className="absolute w-12 h-12 pointer-events-none" style={{ left:l, top:t, zIndex:4,
              background:`radial-gradient(circle at ${i%2===0?'0%':'100%'} ${i<2?'0%':'100%'}, rgba(255,215,0,.5), transparent 70%)`,
              transform: 'none' }} />
          ))}
        </>
      )}

      {/* Void : mini particules flottantes */}
      {rarity === 'void' && (
        <div className="absolute inset-0 pointer-events-none rounded-[inherit] overflow-hidden" style={{ zIndex: 4 }}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="absolute rounded-full"
              style={{
                width: i % 2 === 0 ? '3px' : '2px',
                height: i % 2 === 0 ? '3px' : '2px',
                background: i % 3 === 0 ? '#c084fc' : i % 3 === 1 ? '#a855f7' : '#e9d5ff',
                boxShadow: `0 0 6px #a855f7`,
                left: `${10 + i * 11}%`,
                top:  `${15 + (i % 4) * 20}%`,
                animation: `voidFloat ${1.8 + i * 0.35}s ease-in-out ${i * 0.25}s infinite`,
              }} />
          ))}
        </div>
      )}
    </div>
  )
}
