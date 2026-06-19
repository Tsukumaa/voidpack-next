import { Crown, Code2, Palette } from 'lucide-react'

export type UserRole = 'founder' | 'developer' | 'artist' | null | undefined

const ROLES: Record<
  NonNullable<UserRole>,
  { label: string; color: string }
> = {
  founder:   { label: 'Fondateur',   color: '#9b59b6' },
  developer: { label: 'Développeur', color: '#e23030' },
  artist:    { label: 'Artiste',     color: '#55a84d' },
}

export function RoleBadge({ role }: { role: UserRole }) {
  if (!role) return null
  const { label, color } = ROLES[role]
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide flex-shrink-0"
      style={{ color, background: color + '22', border: `1px solid ${color}55` }}
      title={label}
    >
      {label}
    </span>
  )
}
