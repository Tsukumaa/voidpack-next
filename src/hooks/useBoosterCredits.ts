'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGameStore } from '@/store/game'

export function useBoosterCredits() {
  const { user, pendingCredits, setPendingCredits, removePendingCredit } = useGameStore()
  const supabase = createClient()

  const loadCredits = async () => {
    if (!user) return
    const { data } = await supabase.rpc('get_pending_booster_credits')
    setPendingCredits(data ?? [])
  }

  useEffect(() => {
    if (!user) return
    loadCredits()
  }, [user?.id]) // eslint-disable-line

  return { pendingCredits, loadCredits, removePendingCredit }
}
