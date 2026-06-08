'use client'
import { useAuth } from '@/hooks/useAuth'
import { useBoosterCredits } from '@/hooks/useBoosterCredits'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useAuth()
  useBoosterCredits()
  return <>{children}</>
}
