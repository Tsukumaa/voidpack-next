import { Crown, Code2, Palette, Tv2 } from 'lucide-react'
import React from 'react'

export type UserRole = 'founder' | 'developer' | 'artist' | 'streamer' | null | undefined

const ROLES: Record<
  NonNullable<UserRole>,
  { label: string; color: string; icon: React.ReactNode }
> = {
  founder:   { label: 'Fondateur',   color: '#9b59b6', icon: <Crown   size={11} /> },
  developer: { label: 'Développeur', color: '#e23030', icon: <Code2   size={11} /> },
  artist:    { label: 'Artiste',     color: '#55a84d', icon: <Palette size={11} /> },
  streamer:  { label: 'Streamer',    color: '#9146ff', icon: <Tv2     size={11} /> },
}

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

export function SubscriberBadge({ isSubscriber }: { isSubscriber?: boolean | null }) {
  if (!isSubscriber) return null
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0"
      style={{ background: 'rgba(123,43,255,0.2)', border: '1px solid rgba(123,43,255,0.45)' }}
      title="Abonné VOID Pack"
    >
      <img src="/assets/branding/void-favicon.png" alt="Abonné" width={13} height={13} style={{ objectFit: 'contain' }} />
    </span>
  )
}
