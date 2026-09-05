'use client'
import { useEffect, useRef, useState } from 'react'

const IDLE_MS = 30_000

export function useIdleDetection() {
  const [idle, setIdle] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function reset() {
      if (timer.current) clearTimeout(timer.current)
      setIdle(false)
      timer.current = setTimeout(() => setIdle(true), IDLE_MS)
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      if (timer.current) clearTimeout(timer.current)
      events.forEach(e => window.removeEventListener(e, reset))
    }
  }, [])

  return idle
}
