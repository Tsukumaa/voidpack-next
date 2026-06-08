import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatXp(xp: number): string {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`
  if (xp >= 1_000)     return `${(xp / 1_000).toFixed(1)}k`
  return xp.toLocaleString('fr-FR')
}

export function timeAgo(date: string): string {
  const d = new Date(date)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000)         return 'à l\'instant'
  if (diff < 3_600_000)      return `il y a ${Math.floor(diff / 60_000)}min`
  if (diff < 86_400_000)     return `il y a ${Math.floor(diff / 3_600_000)}h`
  return `il y a ${Math.floor(diff / 86_400_000)}j`
}

export function escapeHtml(str: string): string {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
