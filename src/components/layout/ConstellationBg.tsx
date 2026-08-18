'use client'
import { useEffect, useRef } from 'react'

export function ConstellationBg() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Generate nodes spread across full canvas
    const COUNT = 90
    const nodes = Array.from({ length: COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00012,
      vy: (Math.random() - 0.5) * 0.00012,
      phase: Math.random() * Math.PI * 2,
      speed: 0.2 + Math.random() * 0.4,
    }))

    // Connect nodes that are close enough
    const MAX_DIST = 0.28

    let t = 0
    const draw = () => {
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // Move nodes and bounce off edges
      nodes.forEach(n => {
        n.x += n.vx
        n.y += n.vy
        if (n.x < 0 || n.x > 1) n.vx *= -1
        if (n.y < 0 || n.y > 1) n.vy *= -1
        n.x = Math.max(0, Math.min(1, n.x))
        n.y = Math.max(0, Math.min(1, n.y))
      })

      const pts = nodes.map(n => ({ x: n.x * W, y: n.y * H, phase: n.phase, speed: n.speed }))

      // Edges
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = (pts[i].x - pts[j].x) / W
          const dy = (pts[i].y - pts[j].y) / H
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > MAX_DIST) continue
          const fade = 1 - dist / MAX_DIST
          ctx.beginPath()
          ctx.moveTo(pts[i].x, pts[i].y)
          ctx.lineTo(pts[j].x, pts[j].y)
          ctx.strokeStyle = `rgba(100,40,220,${fade * 0.18})`
          ctx.lineWidth = 0.7
          ctx.stroke()
        }
      }

      // Nodes
      pts.forEach(p => {
        const brightness = 0.4 + 0.6 * Math.sin(t * p.speed + p.phase)
        const r = 1.2 + 0.6 * brightness

        // Glow
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 7)
        g.addColorStop(0, `rgba(140,80,255,${0.15 * brightness})`)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.beginPath()
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()

        // Core
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(190,160,255,${0.5 + 0.5 * brightness})`
        ctx.fill()
      })

      t += 0.012
      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas ref={ref} style={{
      position: 'absolute', inset: 0,
      width: '100%', height: '100%',
      pointerEvents: 'none',
    }} />
  )
}
