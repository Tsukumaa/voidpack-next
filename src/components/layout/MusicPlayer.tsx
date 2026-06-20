'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useSettingsStore } from '@/store/settings'

const MUSIC_MENU   = 'https://imgg.fr/r/UsSEL3zY.mp3'
const MUSIC_COMBAT = 'https://imgg.fr/r/KF3aA7Fy.mp3'

const audios: Record<string, HTMLAudioElement> = {}
let activeUrl: string | null = null

function isCombatRoute(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  return parts[0] === 'combat' && parts.length === 2 && !['draft', 'matchmaking'].includes(parts[1])
}

function getOrCreate(url: string): HTMLAudioElement {
  if (!audios[url]) {
    audios[url] = new Audio(url)
    audios[url].loop = true
  }
  return audios[url]
}

async function startAudio(url: string, volume: number, muted: boolean) {
  const audio = getOrCreate(url)
  audio.volume = volume
  // Muted autoplay : toujours autorisé par les navigateurs
  audio.muted = true
  try {
    await audio.play()
    // Démuté immédiatement après — le son part sans interaction requise
    audio.muted = muted
  } catch {
    // En dernier recours, attendre un clic
    const unlock = () => {
      audio.play().then(() => { audio.muted = muted }).catch(() => {})
      window.removeEventListener('click', unlock)
      window.removeEventListener('touchend', unlock)
    }
    window.addEventListener('click', unlock)
    window.addEventListener('touchend', unlock)
  }
  activeUrl = url
}

function crossfade(fromUrl: string, toUrl: string, volume: number, muted: boolean) {
  const from = getOrCreate(fromUrl)
  const to   = getOrCreate(toUrl)
  to.volume = 0
  to.muted  = true
  to.play().then(() => { to.muted = muted }).catch(() => {})

  const STEPS = 20
  const TICK  = 800 / STEPS
  let step = 0
  const timer = setInterval(() => {
    step++
    from.volume = Math.max(0, volume * (1 - step / STEPS))
    to.volume   = Math.min(volume, volume * (step / STEPS))
    if (step >= STEPS) {
      clearInterval(timer)
      from.pause()
      from.currentTime = 0
      from.volume = volume
      to.volume   = volume
    }
  }, TICK)
  activeUrl = toUrl
}

export function MusicPlayer() {
  const pathname = usePathname()
  const volume   = useSettingsStore(s => s.musicVolume)
  const muted    = useSettingsStore(s => s.musicMuted)
  const ready    = useRef(false)

  const targetUrl = isCombatRoute(pathname) ? MUSIC_COMBAT : MUSIC_MENU

  // Démarrage au premier montage
  useEffect(() => {
    if (ready.current) return
    ready.current = true
    startAudio(targetUrl, volume, muted)
  }, []) // eslint-disable-line

  // Changement de piste
  useEffect(() => {
    if (!ready.current) return
    if (activeUrl === targetUrl) return
    if (!activeUrl) { startAudio(targetUrl, volume, muted); return }
    crossfade(activeUrl, targetUrl, volume, muted)
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
