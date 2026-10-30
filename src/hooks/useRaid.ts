'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { RAID_ACTIVITY_EVENT } from '@/lib/raid-events'

export interface RaidInfo {
  id:           number
  bossName:     string
  description:  string | null
  bossImageUrl: string | null
  hp:           number
  damage:       number                         // dégâts totaux (peuvent dépasser les PV)
  killed:       boolean
  phase:        'running' | 'due' | 'results'  // en cours | fin atteinte, distribution en cours | résultat (48 h)
  endsAt:       string | null
  startedAt:    string
  requiredDays: number                         // jours de mission requis pour la carte promo (assiduité)
  finalizedAt:  string | null
  resultsUntil: string | null
  damageValues: { booster: number; mission: number; allMissions: number }
  rankRewards:  { upToRank: number | null; mana: number }[]
  overkill:     { ratio: number; multiplier: number }[]
  multiplier:   number
  promo: {
    imageUrl: string | null
    rarity:   string
    name:     string | null  // révélé quand le boss est tué
    reveal:   number         // 0 → 1 : avancement du dévoilement
  } | null
  leaderboard: { rank: number; username: string; damage: number }[]
}

export interface RaidMe {
  damage:       number
  missions:     number
  missionDays:    number        // jours avec ≥ 1 mission réclamée pendant le raid
  lastMissionDay: string | null // YYYY-MM-DD (UTC) du dernier jour compté
  rank:         number | null
  manaReward:   number | null
  promoGranted: boolean
}

// Assiduité (même calcul que missionDaysStatus côté serveur) : mission du jour faite ?
// carte promo déjà acquise / encore possible en faisant une mission chaque jour restant ?
export function promoDaysStatus(raid: RaidInfo, me: RaidMe | null, now = new Date()) {
  const days = me?.missionDays ?? 0
  const today = now.toISOString().slice(0, 10)
  const doneToday = me?.lastMissionDay === today
  const lastDay = raid.endsAt ? new Date(raid.endsAt).toISOString().slice(0, 10) : today
  const daysLeft = Math.max(0, Math.round((Date.parse(lastDay) - Date.parse(today)) / 86400_000) + 1) - (doneToday ? 1 : 0)
  return {
    days, doneToday,
    required: raid.requiredDays,
    eligible: days >= raid.requiredDays,
    possible: days + Math.max(0, daysLeft) >= raid.requiredDays,
  }
}

// Moment où la bannière disparaît : fin du raid, ou fin de l'affichage du résultat
export function raidDeadline(raid: RaidInfo): string | null {
  return raid.phase === 'results' ? raid.resultsUntil : raid.endsAt
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

async function getRaid(force = false): Promise<RaidInfo | null> {
  if (!force && lastFetch && Date.now() - lastFetch < pollDelay(cache)) return cache
  if (inflight && !force) return inflight
  // force : contourne le cache CDN (ex. fin du raid atteinte côté navigateur)
  inflight = fetch(force ? `/api/raid?fresh=${Date.now()}` : '/api/raid')
    .then(r => r.ok ? r.json() : null)
    .then((data: RaidInfo | null) => { cache = data; lastFetch = Date.now(); return data })
    .catch(() => cache)
    .finally(() => { inflight = null })
  return inflight
}

export function useRaid() {
  const [raid, setRaid] = useState<RaidInfo | null>(cache)
  // Incrémenté quand le joueur inflige des dégâts (booster, mission) pendant un raid en cours
  const [activity, setActivity] = useState(0)
  const mounted = useRef(true)

  const refresh = useCallback(async (force = false) => {
    const data = await getRaid(force)
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
    // Pas de raid en cours → aucune requête
    const onActivity = () => { if (cache?.phase === 'running') setActivity(a => a + 1) }

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

  return { raid, refresh, applyRaid, activity }
}
