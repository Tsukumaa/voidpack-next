'use client'
import { useState, useEffect, useRef } from 'react'

type Features = Record<string, boolean>

let cache: Features | null = null
let lastFetch = 0

export function useFeatures() {
  const [features, setFeatures] = useState<Features>(cache ?? {})
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    async function load() {
      if (cache && Date.now() - lastFetch < 30_000) { setFeatures(cache); return }
      try {
        const data = await fetch('/api/features').then(r => r.json())
        cache = data; lastFetch = Date.now()
        if (mounted.current) setFeatures(data)
      } catch { /* keep defaults */ }
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
