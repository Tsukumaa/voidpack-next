'use client'

interface AvatarRingProps {
  avatarUrl?: string | null
  username?: string | null
  size?: number
  xpProgress?: number
  isComplete?: boolean
  className?: string
}

export function AvatarRing({ avatarUrl, username, size = 44, xpProgress = 0, isComplete = false, className = '' }: AvatarRingProps) {
  const pad = Math.max(3, Math.round(size * 0.07))
  const inner = size - pad * 2

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>

      {isComplete ? (
        <>
          {/* Glow extérieur */}
          <div className="absolute rounded-full animate-spin-slow"
            style={{
              inset: -pad,
              background: 'conic-gradient(from 0deg, #ff0080, #ff9a3d, #ffe600, #00e5a0, #00b4ff, #a855f7, #ff0080)',
              filter: `blur(${Math.round(size * 0.14)}px)`,
              opacity: 0.7,
              borderRadius: '50%',
            }} />
          {/* Anneau net */}
          <div className="absolute inset-0 rounded-full animate-spin-slow"
            style={{
              background: 'conic-gradient(from 0deg, #ff0080, #ff9a3d, #ffe600, #00e5a0, #00b4ff, #a855f7, #ff0080)',
              borderRadius: '50%',
            }} />
        </>
      ) : (
        <div className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from -90deg, #7b2bff, #a855f7 ${xpProgress}%, rgba(255,255,255,0.08) ${xpProgress}%)`,
            borderRadius: '50%',
          }} />
      )}

      {/* Fond séparateur */}
      <div className="absolute rounded-full bg-[#0a0612]"
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

      {/* Badge ★ collection complète */}
      {isComplete && (
        <div className="absolute flex items-center justify-center rounded-full font-black"
          style={{
            width: Math.max(14, Math.round(size * 0.32)),
            height: Math.max(14, Math.round(size * 0.32)),
            fontSize: Math.max(8, Math.round(size * 0.16)),
            bottom: -2, right: -2,
            background: 'linear-gradient(135deg, #ffe600, #ff9a3d)',
            boxShadow: '0 0 8px rgba(255,200,0,0.9), 0 0 20px rgba(255,150,0,0.4)',
            border: `${Math.max(1, Math.round(size * 0.04))}px solid #0a0612`,
            color: '#0a0612',
            lineHeight: 1,
          }}>
          ★
        </div>
      )}
    </div>
  )
}
