'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useSettingsStore } from '@/store/settings'

const MUSIC_MENU   = 'https://imgg.fr/r/UsSEL3zY.mp3'
const MUSIC_COMBAT = 'https://imgg.fr/r/KF3aA7Fy.mp3'

// Singletons module-level — survivent aux navigations et changements de layout
const audios: Record<string, HTMLAudioElement> = {}
let started = false

function getAudio(url: string): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!audios[url]) {
    const a = new Audio(url)
    a.loop   = true
    a.volume = useSettingsStore.getState().musicVolume
    a.muted  = useSettingsStore.getState().musicMuted
    audios[url] = a
  }
  return audios[url]
}

function isCombatRoute(pathname: string) {
  // Combat music sur /combat/training et /combat/[id] (vraie partie)
  // Pas sur /combat/draft, /combat/matchmaking, /combat/join/*
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'combat' || parts.length !== 2) return false
  return !['draft', 'matchmaking'].includes(parts[1])
}

function crossfade(fromUrl: string, toUrl: string, volume: number) {
  const from = getAudio(fromUrl)
  const to   = getAudio(toUrl)
  if (!from || !to) return

  const STEPS    = 20
  const INTERVAL = 800 / STEPS
  let step = 0

  to.volume = 0
  to.play().catch(() => {})

  const fade = setInterval(() => {
    step++
    from.volume = Math.max(0, volume - (volume / STEPS) * step)
    to.volume   = Math.min(volume, (volume / STEPS) * step)
    if (step >= STEPS) {
      clearInterval(fade)
      from.pause()
      from.currentTime = 0
      from.volume = volume
      to.volume   = volume
    }
  }, INTERVAL)
}

export function MusicPlayer() {
  const pathname  = usePathname()
  const volume    = useSettingsStore(s => s.musicVolume)
  const muted     = useSettingsStore(s => s.musicMuted)
  const activeUrl = useRef<string | null>(null)

  const targetUrl = isCombatRoute(pathname) ? MUSIC_COMBAT : MUSIC_MENU

  // Tentative autoplay immédiate au premier montage, fallback sur interaction
  useEffect(() => {
    if (started) return
    const audio = getAudio(targetUrl)
    if (!audio) return

    audio.play().then(() => {
      started = true
      activeUrl.current = targetUrl
    }).catch(() => {
      // Navigateur bloque l'autoplay — on attend la première interaction
      const onInteract = () => {
        if (started) return
        const a = getAudio(targetUrl)
        if (!a) return
        a.play().then(() => {
          started = true
          activeUrl.current = targetUrl
        }).catch(() => {})
        window.removeEventListener('click',   onInteract)
        window.removeEventListener('keydown', onInteract)
        window.removeEventListener('touchend', onInteract)
      }
      window.addEventListener('click',    onInteract)
      window.addEventListener('keydown',  onInteract)
      window.addEventListener('touchend', onInteract)
    })
  }, []) // eslint-disable-line

  // Changement de piste selon la page
  useEffect(() => {
    if (!started) {
      // Pas encore démarré : mémoriser la cible pour quand ça démarrera
      activeUrl.current = targetUrl
      return
    }
    if (activeUrl.current === targetUrl) return
    const prev = activeUrl.current ?? MUSIC_MENU
    activeUrl.current = targetUrl
    crossfade(prev, targetUrl, volume)
  }, [targetUrl]) // eslint-disable-line

  // Sync volume
  useEffect(() => {
    Object.values(audios).forEach(a => { if (!a.paused) a.volume = volume })
  }, [volume])

  // Sync mute
  useEffect(() => {
    Object.values(audios).forEach(a => { a.muted = muted })
  }, [muted])

  return null
}
