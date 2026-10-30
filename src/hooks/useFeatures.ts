'use client'
import { useState, useEffect, useRef } from 'react'

type Features = Record<string, boolean>

// Cache court : un événement (Void Day) activé dans l'admin doit apparaître vite chez tout le monde.
// La route est cachée 30 s côté CDN, donc ce poll ne coûte presque rien au serveur.
const TTL = 60_000
const CHANGED_EVENT = 'features-changed'
const CHANNEL = 'voidpack-features'

let cache: Features | null = null
let lastFetch = 0
let inflight: Promise<Features> | null = null

// Fetcher partagé : cache 60s + dédup des appels simultanés.
// force : contourne le cache navigateur et CDN (paramètre unique).
export async function getFeatures(force = false): Promise<Features> {
  if (!force && cache && Date.now() - lastFetch < TTL) return cache
  if (inflight && !force) return inflight
  inflight = fetch(force ? `/api/features?t=${Date.now()}` : '/api/features', force ? { cache: 'no-store' } : undefined)
    .then(r => r.json())
    .then((data: Features) => { cache = data; lastFetch = Date.now(); return data })
    .catch(() => cache ?? {})
    .finally(() => { inflight = null })
  return inflight
}

// À appeler après un changement de réglage (admin) : met à jour tous les composants
// de l'onglet courant et des autres onglets ouverts, sans attendre le prochain poll.
export async function refreshFeatures() {
  await getFeatures(true)
  window.dispatchEvent(new Event(CHANGED_EVENT))
  try { const bc = new BroadcastChannel(CHANNEL); bc.postMessage('changed'); bc.close() } catch { /* */ }
}

export function useFeatures() {
  const [features, setFeatures] = useState<Features>(cache ?? {})
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    async function load(force = false) {
      const data = await getFeatures(force)
      if (mounted.current) setFeatures(data)
    }
    load()
    // Pas de requête quand l'onglet est caché ; rattrapage au retour
    const id = setInterval(() => { if (document.visibilityState === 'visible') load() }, TTL)
    const onVisibility = () => { if (document.visibilityState === 'visible') load() }
    const onChanged = () => { if (cache && mounted.current) setFeatures(cache) }
    let bc: BroadcastChannel | null = null
    try { bc = new BroadcastChannel(CHANNEL); bc.onmessage = () => load(true) } catch { /* */ }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener(CHANGED_EVENT, onChanged)
    return () => {
      mounted.current = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener(CHANGED_EVENT, onChanged)
      bc?.close()
    }
  }, [])

  function isEnabled(key: string) {
    if (!(key in features)) return true
    return features[key]
  }

  return { features, isEnabled }
}
