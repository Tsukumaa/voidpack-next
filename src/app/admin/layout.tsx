'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/store/game'
import { useAuth } from '@/hooks/useAuth'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { authStatus, profile } = useGameStore(s => ({
    authStatus: s.authStatus,
    profile:    s.profile,
  }))
  useAuth()

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/pack')
    }
    if (authStatus === 'authenticated' && profile && !profile.is_admin) {
      router.push('/pack')
    }
  }, [authStatus, profile, router])

  if (authStatus === 'loading' || authStatus === 'idle') {
    return (
      <div className="min-h-svh bg-[#06010e] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#7b2bff]/20 border-t-[#7b2bff] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-[#06010e] text-[#f6f1ff]">
      {children}
    </div>
  )
}
