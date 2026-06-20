'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useSettingsStore } from '@/store/settings'

const MUSIC_MENU   = 'https://imgg.fr/r/UsSEL3zY.mp3'
const MUSIC_COMBAT = 'https://imgg.fr/r/KF3aA7Fy.mp3'

// Singletons — survivent aux navigations Next.js
const audios: Record<string, HTMLAudioElement> = {}
let started = false

function getAudio(url: string): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!audios[url]) {
    const a = new Audio(url)
    a.loop = true
    a.volume = useSettingsStore.getState().musicVolume
    a.muted  = useSettingsStore.getState().musicMuted
    audios[url] = a
  }
  return audios[url]
}

function tryStart(url: string) {
  if (started) return
  const a = getAudio(url)
  if (!a) return
  started = true
  a.play().catch(() => { started = false })
}

export function MusicPlayer() {
  const pathname   = usePathname()
  const volume     = useSettingsStore(s => s.musicVolume)
  const muted      = useSettingsStore(s => s.musicMuted)
  const activeUrl  = useRef<string>(MUSIC_MENU)

  // Musique combat uniquement dans une partie active (/combat/[id] mais pas /combat/matchmaking etc.)
  const isCombat   = /^\/combat\/[^/]+$/.test(pathname) && !['draft','matchmaking','training','join'].some(s => pathname.includes(s))
  const targetUrl  = isCombat ? MUSIC_COMBAT : MUSIC_MENU

  // Démarrage à la première interaction
  useEffect(() => {
    const start = () => {
      tryStart(targetUrl)
      window.removeEventListener('click',   start)
      window.removeEventListener('keydown', start)
    }
    if (!started) {
      window.addEventListener('click',   start)
      window.addEventListener('keydown', start)
    }
  }, []) // eslint-disable-line

  // Changement de piste selon la page
  useEffect(() => {
    if (activeUrl.current === targetUrl) return
    const prev = getAudio(activeUrl.current)
    const next = getAudio(targetUrl)
    if (!prev || !next) return

    activeUrl.current = targetUrl

    if (!started) return  // pas encore démarré, on mémorise juste la piste cible

    // Fondu enchaîné
    const FADE = 800
    const steps = 20
    const interval = FADE / steps
    let step = 0

    const fadeOut = setInterval(() => {
      step++
      if (prev.volume > volume / steps) prev.volume = Math.max(0, prev.volume - volume / steps)
      if (step >= steps) {
        clearInterval(fadeOut)
        prev.pause()
        prev.currentTime = 0
        prev.volume = volume
        next.volume = 0
        next.play().catch(() => {})
        let stepIn = 0
        const fadeIn = setInterval(() => {
          stepIn++
          next.volume = Math.min(volume, next.volume + volume / steps)
          if (stepIn >= steps) { clearInterval(fadeIn); next.volume = volume }
        }, interval)
      }
    }, interval)
  }, [targetUrl]) // eslint-disable-line

  // Sync volume sur toutes les pistes
  useEffect(() => {
    Object.values(audios).forEach(a => { if (!a.paused) a.volume = volume })
  }, [volume])

  // Sync mute sur toutes les pistes
  useEffect(() => {
    Object.values(audios).forEach(a => { a.muted = muted })
  }, [muted])

  return null
}
