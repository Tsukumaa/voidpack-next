'use client'
import { useState } from 'react'
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
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)

  // Glow needs room outside the avatar bounds — we allocate extra space so parents
  // with overflow:hidden don't clip it. The avatar itself stays `size` pixels.
  const glow   = isComplete ? Math.round(size * 0.18) : 0
  const total  = size + glow * 2   // outer div size (includes glow bleed)
  const pad    = Math.max(3, Math.round(size * 0.07))
  const badgeSize = Math.max(14, Math.round(size * 0.34))
  const iconSize  = Math.max(8,  Math.round(badgeSize * 0.6))

  // All absolute children are offset by `glow` so they sit centered in `total`
  const o = glow  // shorthand for the offset

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: total, height: total, margin: -glow }}   // negative margin keeps layout footprint = size
    >
      {isComplete ? (
        <>
          {/* Glow blur — sits in the extra space */}
          <div className="absolute rounded-full animate-spin-slow pointer-events-none"
            style={{
              inset: 0,
              background: 'conic-gradient(from 0deg, #ff0080, #ff9a3d, #ffe600, #00e5a0, #00b4ff, #a855f7, #ff0080)',
              filter: `blur(${Math.round(size * 0.14)}px)`,
              opacity: 0.75,
              borderRadius: '50%',
            }} />
          {/* Sharp ring */}
          <div className="absolute rounded-full animate-spin-slow pointer-events-none"
            style={{
              inset: glow,
              background: 'conic-gradient(from 0deg, #ff0080, #ff9a3d, #ffe600, #00e5a0, #00b4ff, #a855f7, #ff0080)',
              borderRadius: '50%',
            }} />
        </>
      ) : (
        <div className="absolute rounded-full pointer-events-none"
          style={{
            inset: o,
            background: `conic-gradient(from -90deg, #7b2bff, #a855f7 ${xpProgress}%, rgba(255,255,255,0.08) ${xpProgress}%)`,
            borderRadius: '50%',
          }} />
      )}

      {/* Separator */}
      <div className="absolute rounded-full bg-[#0a0612] pointer-events-none"
        style={{ inset: o + pad - 1, borderRadius: '50%' }} />

      {/* Avatar */}
      <div className="absolute rounded-full overflow-hidden flex items-center justify-center bg-[#0a0612]"
        style={{
          inset: o + pad,
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
            bottom: o - 2, right: o - 2,
            background: 'linear-gradient(135deg, #ffe600, #ff9a3d)',
            boxShadow: '0 0 10px rgba(255,200,0,0.9), 0 0 22px rgba(255,130,0,0.45)',
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
