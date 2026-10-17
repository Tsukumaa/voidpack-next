'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { RAID_ACTIVITY_EVENT } from '@/lib/raid-events'

export interface RaidTierInfo {
  threshold:   number
  boosters:    number
  boosterType: string
}

export interface RaidInfo {
  id:              number
  title:           string
  description:     string | null
  objectiveType:   string
  goal:            number
  progress:        number
  minContribution: number
  tiers:           RaidTierInfo[]
  phase:           'running' | 'claim' // en cours | objectif atteint, réclamation ouverte
  endsAt:          string | null
  claimUntil:      string | null       // fin de la réclamation (phase 'claim')
}

export interface RaidMe {
  contribution: number
  claimedTiers: number[]
}

// Moment où le raid disparaît : fin de la réclamation si l'objectif est atteint, sinon date de fin
export function raidDeadline(raid: RaidInfo): string | null {
  return raid.phase === 'claim' ? raid.claimUntil : raid.endsAt
}

export const RAID_OBJECTIVE_LABELS: Record<string, { label: string; unit: string }> = {
  boosters_opened:  { label: 'Boosters ouverts',  unit: 'boosters'  },
  combats_won:      { label: 'Combats gagnés',    unit: 'victoires' },
  cards_recycled:   { label: 'Cartes recyclées',  unit: 'cartes'    },
  trades_completed: { label: 'Échanges réalisés', unit: 'échanges'  },
}

// Rythme de vérification : 1 min pendant un raid, 5 min sans raid.
// Onglet caché → aucune requête ; on rattrape au retour sur l'onglet.
const POLL_ACTIVE_MS = 60_000
const POLL_IDLE_MS   = 300_000
const pollDelay = (raid: RaidInfo | null) => raid ? POLL_ACTIVE_MS : POLL_IDLE_MS

// État partagé au niveau module : le header est remonté à chaque changement de layout
let cache: RaidInfo | null = null
let lastFetch = 0
let inflight: Promise<RaidInfo | null> | null = null

async function getRaid(): Promise<RaidInfo | null> {
  if (lastFetch && Date.now() - lastFetch < pollDelay(cache)) return cache
  if (inflight) return inflight
  inflight = fetch('/api/raid')
    .then(r => r.ok ? r.json() : null)
    .then((data: RaidInfo | null) => { cache = data; lastFetch = Date.now(); return data })
    .catch(() => cache)
    .finally(() => { inflight = null })
  return inflight
}

export function useRaid() {
  const [raid, setRaid] = useState<RaidInfo | null>(cache)
  // Incrémenté quand une action du joueur compte pour le raid en cours
  const [activity, setActivity] = useState(0)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    const data = await getRaid()
    if (mounted.current) setRaid(data)
  }, [])

  // Mise à jour du raid depuis une autre réponse (/api/raid/me) : évite un appel à /api/raid
  const applyRaid = useCallback((data: RaidInfo | null) => {
    cache = data; lastFetch = Date.now()
    if (mounted.current) setRaid(data)
  }, [])

  useEffect(() => {
    mounted.current = true
    let timer: ReturnType<typeof setTimeout> | undefined

    const schedule = () => {
      clearTimeout(timer)
      if (document.visibilityState !== 'visible') return
      timer = setTimeout(async () => { await refresh(); schedule() }, pollDelay(cache))
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh().then(schedule)
      else clearTimeout(timer)
    }
    // Ignore les actions qui ne concernent pas le raid affiché (aucune requête)
    const onActivity = (e: Event) => {
      if (cache && cache.objectiveType === (e as CustomEvent<string>).detail) setActivity(a => a + 1)
    }

    refresh().then(schedule)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener(RAID_ACTIVITY_EVENT, onActivity)
    return () => {
      mounted.current = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener(RAID_ACTIVITY_EVENT, onActivity)
    }
  }, [refresh])

  return { raid, applyRaid, activity }
}

// Nombre de paliers atteints par la jauge globale
export function reachedTiers(raid: RaidInfo): number {
  return raid.tiers.filter(t => raid.progress >= t.threshold).length
}
