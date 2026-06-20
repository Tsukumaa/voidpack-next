'use client'

interface AvatarRingProps {
  avatarUrl?: string | null
  username?: string | null
  size?: number
  xpProgress?: number       // 0-100, anneau XP violet
  isComplete?: boolean      // collection complète → anneau rainbow animé
  className?: string
}

export function AvatarRing({ avatarUrl, username, size = 44, xpProgress = 0, isComplete = false, className = '' }: AvatarRingProps) {
  const inner = size - 8

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      {/* Ring */}
      {isComplete ? (
        <div className="absolute inset-0 rounded-full animate-spin-slow"
          style={{
            background: 'conic-gradient(from 0deg, #ff0080, #ff9a3d, #ffef00, #00c896, #4aa3ff, #a855f7, #ff0080)',
            borderRadius: '50%',
            padding: 3,
          }}>
          <div className="w-full h-full rounded-full" style={{ background: '#0a0612' }} />
        </div>
      ) : (
        <div className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from -90deg, #7b2bff, #a855f7 ${xpProgress}%, rgba(255,255,255,0.08) ${xpProgress}%)`,
            padding: 3,
          }}>
          <div className="w-full h-full rounded-full" style={{ background: '#0a0612' }} />
        </div>
      )}

      {/* Avatar */}
      <div className="absolute rounded-full overflow-hidden flex items-center justify-center bg-[#0a0612]"
        style={{ inset: 3, backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined, backgroundSize: 'cover' }}>
        {!avatarUrl && (
          <span className="font-black text-white" style={{ fontSize: size * 0.3 }}>
            {username?.[0]?.toUpperCase() ?? '?'}
          </span>
        )}
      </div>

      {/* Badge collection complète */}
      {isComplete && (
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px]"
          style={{ background: 'linear-gradient(135deg,#ffef00,#ff9a3d)', boxShadow: '0 0 6px rgba(255,200,0,0.8)', border: '1.5px solid #0a0612' }}>
          ★
        </div>
      )}
    </div>
  )
}
