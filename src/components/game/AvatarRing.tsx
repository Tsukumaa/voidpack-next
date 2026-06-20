'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface AvatarRingProps {
  avatarUrl?: string | null
  username?: string | null
  size?: number
  xpProgress?: number
  isComplete?: boolean
  className?: string
}

export function AvatarRing({ avatarUrl, username, size = 44, xpProgress = 0, isComplete = false, className = '' }: AvatarRingProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [glowRect, setGlowRect] = useState<{ x: number; y: number } | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)

  // Track position for portal glow
  useEffect(() => {
    if (!isComplete) return
    const update = () => {
      if (!rootRef.current) return
      const r = rootRef.current.getBoundingClientRect()
      setGlowRect({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [isComplete])

  const pad       = Math.max(3, Math.round(size * 0.07))
  const glowExtra = Math.round(size * 0.28)
  const badgeSize = Math.max(14, Math.round(size * 0.34))
  const iconSize  = Math.max(8,  Math.round(badgeSize * 0.6))

  return (
    <div ref={rootRef} className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>

      {/* Ring (sharp, contained in size×size) */}
      {isComplete ? (
        <div className="absolute inset-0 animate-spin-slow pointer-events-none"
          style={{
            borderRadius: '50%',
            background: 'conic-gradient(from 0deg, #ff0080, #ff9a3d, #ffe600, #00e5a0, #00b4ff, #a855f7, #ff0080)',
          }} />
      ) : (
        <div className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: '50%',
            background: `conic-gradient(from -90deg, #7b2bff, #a855f7 ${xpProgress}%, rgba(255,255,255,0.08) ${xpProgress}%)`,
          }} />
      )}

      {/* Separator */}
      <div className="absolute rounded-full bg-[#0a0612] pointer-events-none"
        style={{ inset: pad - 1, borderRadius: '50%' }} />

      {/* Avatar */}
      <div className="absolute rounded-full overflow-hidden flex items-center justify-center bg-[#0a0612]"
        style={{
          inset: pad,
          backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: '50%',
        }}>
        {!avatarUrl && (
          <span className="font-black text-white select-none" style={{ fontSize: Math.round(size * 0.32) }}>
            {username?.[0]?.toUpperCase() ?? '?'}
          </span>
        )}
      </div>

      {/* Badge ★ */}
      {isComplete && (
        <div
          className="absolute flex items-center justify-center rounded-full cursor-default"
          style={{
            width: badgeSize, height: badgeSize,
            bottom: -2, right: -2,
            background: 'linear-gradient(135deg, #ffe600, #ff9a3d)',
            boxShadow: '0 0 8px rgba(255,200,0,0.8)',
            border: `${Math.max(1, Math.round(size * 0.04))}px solid #0a0612`,
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setTooltip({ x: r.left + r.width / 2, y: r.top })
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="#0a0612">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
      )}

      {/* Glow via portal — échapper à tout overflow:hidden parent */}
      {isComplete && glowRect && typeof document !== 'undefined' && createPortal(
        <div
          className="pointer-events-none animate-spin-slow"
          style={{
            position: 'fixed',
            width: size + glowExtra * 2,
            height: size + glowExtra * 2,
            left: glowRect.x - size / 2 - glowExtra,
            top:  glowRect.y - size / 2 - glowExtra,
            borderRadius: '50%',
            background: 'conic-gradient(from 0deg, #ff0080, #ff9a3d, #ffe600, #00e5a0, #00b4ff, #a855f7, #ff0080)',
            filter: `blur(${Math.round(size * 0.22)}px)`,
            opacity: 0.65,
            zIndex: 0,
          }}
        />,
        document.body
      )}

      {/* Tooltip via portal */}
      {tooltip && typeof document !== 'undefined' && createPortal(
        <div
          className="pointer-events-none whitespace-nowrap rounded-xl px-3 py-2 text-[11px] font-semibold"
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: 'translateX(-50%) translateY(-100%)',
            background: 'rgba(12,8,24,0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,210,0,0.2)',
            color: '#ffd966',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
            zIndex: 99999,
            letterSpacing: '0.02em',
          }}
        >
          Possède toutes les cartes de VOID Pack
        </div>,
        document.body
      )}
    </div>
  )
}
