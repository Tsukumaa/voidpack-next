import { Crown, Code2, Palette, Tv2 } from 'lucide-react'

export type UserRole = 'founder' | 'developer' | 'artist' | 'streamer' | null | undefined

const ROLES: Record<
  NonNullable<UserRole>,
  { label: string; color: string; icon: React.ReactNode }
> = {
  founder:   { label: 'Fondateur',   color: '#9b59b6', icon: <Crown   size={11} /> },
  developer: { label: 'Développeur', color: '#e23030', icon: <Code2   size={11} /> },
  artist:    { label: 'Artiste',     color: '#55a84d', icon: <Palette size={11} /> },
  streamer:  { label: 'Streameur',   color: '#9146ff', icon: <Tv2    size={11} /> },
}

import React from 'react'

export function RoleBadge({ role }: { role: UserRole }) {
  if (!role) return null
  const { label, color, icon } = ROLES[role]
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0"
      style={{ color, background: color + '22', border: `1px solid ${color}55` }}
      title={label}
    >
      {icon}
    </span>
  )
}
