'use client'
import { useEffect } from 'react'
import { useGameStore } from '@/store/game'

export function useBoosterCredits() {
  const { user, pendingCredits, setPendingCredits, removePendingCredit } = useGameStore()

  const loadCredits = async () => {
    if (!user) return
    const res = await fetch('/api/booster/credits')
    if (res.ok) {
      const data = await res.json()
      setPendingCredits(data ?? [])
    }
  }

  useEffect(() => {
    if (!user) return
    loadCredits()
  }, [user?.id]) // eslint-disable-line

  return { pendingCredits, loadCredits, removePendingCredit }
}
