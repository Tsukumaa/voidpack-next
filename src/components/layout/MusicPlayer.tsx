'use client'
import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settings'

const MUSIC_URL = 'https://imgg.fr/r/UsSEL3zY.mp3'

// Singleton — survit aux navigations Next.js
let audio: HTMLAudioElement | null = null
let started = false

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!audio) {
    audio = new Audio(MUSIC_URL)
    audio.loop   = true
    audio.volume = useSettingsStore.getState().musicVolume
    audio.muted  = useSettingsStore.getState().musicMuted
  }
  return audio
}

function tryStart() {
  if (started) return
  const a = getAudio()
  if (!a) return
  started = true
  a.play().catch(() => { started = false })
  window.removeEventListener('click',   tryStart)
  window.removeEventListener('keydown', tryStart)
}

export function MusicPlayer() {
  const volume = useSettingsStore(s => s.musicVolume)
  const muted  = useSettingsStore(s => s.musicMuted)

  // Enregistrer les listeners au premier montage (une seule fois)
  useEffect(() => {
    const a = getAudio()
    if (!a) return
    window.addEventListener('click',   tryStart)
    window.addEventListener('keydown', tryStart)
    // Pas de cleanup — on garde les listeners et l'audio vivants
  }, [])

  // Sync volume
  useEffect(() => {
    const a = getAudio()
    if (a) a.volume = volume
  }, [volume])

  // Sync mute
  useEffect(() => {
    const a = getAudio()
    if (a) a.muted = muted
  }, [muted])

  return null
}
