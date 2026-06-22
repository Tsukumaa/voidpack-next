'use client'
import { useState, useEffect, useRef } from 'react'

type Features = Record<string, boolean>

let cache: Features | null = null
let lastFetch = 0
let inflight: Promise<Features> | null = null

// Fetcher partagé : cache 30s + dédup des appels simultanés
export async function getFeatures(): Promise<Features> {
  if (cache && Date.now() - lastFetch < 30_000) return cache
  if (inflight) return inflight
  inflight = fetch('/api/features')
    .then(r => r.json())
    .then((data: Features) => { cache = data; lastFetch = Date.now(); return data })
    .catch(() => cache ?? {})
    .finally(() => { inflight = null })
  return inflight
}

export function useFeatures() {
  const [features, setFeatures] = useState<Features>(cache ?? {})
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    async function load() {
      const data = await getFeatures()
      if (mounted.current) setFeatures(data)
    }
    load()
    const id = setInterval(load, 30_000)
    return () => { mounted.current = false; clearInterval(id) }
  }, [])

  function isEnabled(key: string) {
    if (!(key in features)) return true
    return features[key]
  }

  return { features, isEnabled }
}
