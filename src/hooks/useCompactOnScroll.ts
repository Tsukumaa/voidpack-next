'use client'
import { useEffect, useState } from 'react'

// Passe en mode compact pendant le défilement, avec hystérésis : compact au-delà de
// `down` px, déployé seulement en revenant sous `up` px. L'écart doit dépasser la
// variation de hauteur du bandeau : sinon, en rétrécissant, il fait remonter la page
// sous le seuil, se redéploie, la page redescend… et le bandeau clignote en boucle.
export function useCompactOnScroll(enabled: boolean, down = 120, up = 20): boolean {
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const onScroll = () => {
      const y = window.scrollY
      setCompact(prev => prev ? y > up : y > down)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [enabled, down, up])

  return compact
}
