'use client'
import { useEffect } from 'react'
import { useGameStore } from '@/store/game'

const CREDITS_TTL = 15_000

export function useBoosterCredits() {
  const { user, pendingCredits, setPendingCredits, removePendingCredit, creditsFetchedAt, creditsLoading, setCreditsLoading } = useGameStore()

  const loadCredits = async (force = false) => {
    if (!user) return
    if (!force) {
      if (creditsLoading) return
      if (creditsFetchedAt && Date.now() - creditsFetchedAt < CREDITS_TTL) return
    }
    setCreditsLoading(true)
    try {
      const res = await fetch('/api/booster/credits')
      if (res.ok) setPendingCredits(await res.json() ?? [])
    } finally {
      setCreditsLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    loadCredits()
  }, [user?.id]) // eslint-disable-line

  return { pendingCredits, loadCredits, removePendingCredit }
}
