'use client'
import { useEffect, useState } from 'react'

// Récupère l'image du fond d'arène sélectionné par le joueur (skin).
// Retombe sur bg-void par défaut.
export function useArenaBg(): string | null {
  const [bg, setBg] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/profile/arena')
      .then(r => r.json())
      .then(d => { if (alive) setBg(d?.imageUrl ?? null) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  return bg
}
