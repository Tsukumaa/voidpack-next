'use client'
import { useState } from 'react'

interface AvatarRingProps {
  avatarUrl?: string | null
  username?: string | null
  size?: number
  xpProgress?: number
  isComplete?: boolean
  className?: string
}

export function AvatarRing({ avatarUrl, username, size = 44, xpProgress = 0, isComplete = false, className = '' }: AvatarRingProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const pad = Math.max(3, Math.round(size * 0.07))
  const badgeSize = Math.max(14, Math.round(size * 0.34))
  const iconSize  = Math.max(8, Math.round(badgeSize * 0.6))

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>

      {isComplete ? (
        <>
          {/* Glow */}
          <div className="absolute rounded-full animate-spin-slow pointer-events-none"
            style={{
              inset: -pad,
              background: 'conic-gradient(from 0deg, #ff0080, #ff9a3d, #ffe600, #00e5a0, #00b4ff, #a855f7, #ff0080)',
              filter: `blur(${Math.round(size * 0.14)}px)`,
              opacity: 0.75,
              borderRadius: '50%',
            }} />
          {/* Anneau net */}
          <div className="absolute inset-0 rounded-full animate-spin-slow pointer-events-none"
            style={{
              background: 'conic-gradient(from 0deg, #ff0080, #ff9a3d, #ffe600, #00e5a0, #00b4ff, #a855f7, #ff0080)',
              borderRadius: '50%',
            }} />
        </>
      ) : (
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `conic-gradient(from -90deg, #7b2bff, #a855f7 ${xpProgress}%, rgba(255,255,255,0.08) ${xpProgress}%)`,
            borderRadius: '50%',
          }} />
      )}

      {/* Séparateur */}
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

      {/* Badge collection complète */}
      {isComplete && (
        <div
          className="absolute flex items-center justify-center rounded-full cursor-default"
          style={{
            width: badgeSize, height: badgeSize,
            bottom: -2, right: -2,
            background: 'linear-gradient(135deg, #ffe600, #ff9a3d)',
            boxShadow: '0 0 10px rgba(255,200,0,0.9), 0 0 22px rgba(255,130,0,0.45)',
            border: `${Math.max(1, Math.round(size * 0.04))}px solid #0a0612`,
            zIndex: 10,
          }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {/* Icône étoile SVG */}
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="#0a0612">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>

          {/* Tooltip */}
          {showTooltip && (
            <div
              className="absolute pointer-events-none whitespace-nowrap rounded-xl px-3 py-2 text-[11px] font-semibold tracking-wide"
              style={{
                bottom: 'calc(100% + 10px)',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'linear-gradient(135deg, rgba(255,230,0,0.12), rgba(255,154,61,0.08))',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,210,0,0.25)',
                color: '#ffd966',
                boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,200,0,0.08)',
                zIndex: 50,
                letterSpacing: '0.02em',
              }}
            >
              Possède toutes les cartes de VOID Pack
            </div>
          )}
        </div>
      )}
    </div>
  )
}
