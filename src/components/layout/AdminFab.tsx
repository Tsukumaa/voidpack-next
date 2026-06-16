'use client'
import Link from 'next/link'
import { useGameStore } from '@/store/game'

export function AdminFab() {
  const profile = useGameStore(s => s.profile)
  if (!profile?.is_admin) return null

  return (
    <Link
      href="/admin"
      className="fixed bottom-24 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center text-base shadow-lg transition-all hover:scale-110 active:scale-95"
      style={{
        background: 'linear-gradient(135deg, #7b2bff, #a855f7)',
        boxShadow: '0 0 16px rgba(123,43,255,0.5)',
      }}
      title="Panel Admin"
    >
      ⬡
    </Link>
  )
}
