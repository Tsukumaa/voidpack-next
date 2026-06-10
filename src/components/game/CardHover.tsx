'use client'
import { useRef, useCallback } from 'react'

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

      {/* Void : particules flottantes permanentes */}
      {rarity === 'void' && (
        <div className="absolute inset-0 pointer-events-none rounded-[inherit] overflow-hidden z-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="absolute rounded-full"
              style={{
                width: '3px', height: '3px',
                background: i % 2 === 0 ? '#a855f7' : '#c084fc',
                boxShadow: '0 0 6px #a855f7',
                left: `${15 + i * 14}%`,
                top: `${20 + (i % 3) * 25}%`,
                animation: `voidFloat ${2 + i * 0.4}s ease-in-out ${i * 0.3}s infinite`,
              }} />
          ))}
        </div>
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
    </div>
  )
}
