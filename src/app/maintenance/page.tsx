'use client'
import { useEffect, useRef } from 'react'

export default function MaintenancePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
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

    // Constellation nodes — positions relative to canvas center
    const nodes = [
      { ox: 0,    oy: -140 },
      { ox: 90,   oy: -80  },
      { ox: 130,  oy: 20   },
      { ox: 70,   oy: 110  },
      { ox: -30,  oy: 160  },
      { ox: -120, oy: 80   },
      { ox: -150, oy: -30  },
      { ox: -80,  oy: -110 },
      { ox: 40,   oy: -200 },
      { ox: 190,  oy: -50  },
      { ox: 200,  oy: 100  },
      { ox: -190, oy: -120 },
      { ox: -220, oy: 60   },
      { ox: 20,   oy: 240  },
      { ox: -60,  oy: -240 },
    ]

    // Edges
    const edges = [
      [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],
      [0,8],[1,9],[2,10],[6,11],[5,12],[3,13],[7,14],
      [1,7],[2,5],[0,6],
    ]

    // Twinkle state per node
    const twinkle = nodes.map(() => ({
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.5,
    }))

    let t = 0

    const draw = () => {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const cx = canvas.width / 2
      const cy = canvas.height / 2

      const pts = nodes.map(n => ({ x: cx + n.ox, y: cy + n.oy }))

      // Draw edges
      edges.forEach(([a, b]) => {
        const pa = pts[a], pb = pts[b]
        const dx = pb.x - pa.x, dy = pb.y - pa.y
        const dist = Math.sqrt(dx*dx + dy*dy)
        const grad = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y)
        const opacity = Math.max(0.04, 0.14 - dist / 3000)
        grad.addColorStop(0, `rgba(167,139,250,${opacity})`)
        grad.addColorStop(0.5, `rgba(123,43,255,${opacity * 1.6})`)
        grad.addColorStop(1, `rgba(167,139,250,${opacity})`)
        ctx.beginPath()
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(pb.x, pb.y)
        ctx.strokeStyle = grad
        ctx.lineWidth = 0.8
        ctx.stroke()
      })

      // Draw nodes
      nodes.forEach((_, i) => {
        const p = pts[i]
        const tw = twinkle[i]
        const brightness = 0.5 + 0.5 * Math.sin(t * tw.speed + tw.phase)

        // Glow
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 8)
        glow.addColorStop(0, `rgba(167,139,250,${0.25 * brightness})`)
        glow.addColorStop(1, 'rgba(167,139,250,0)')
        ctx.beginPath()
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()

        // Core dot
        ctx.beginPath()
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200,180,255,${0.5 + 0.5 * brightness})`
        ctx.fill()
      })

      t += 0.016
      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <>
      <style>{`
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fade-up 0.9s cubic-bezier(0.16,1,0.3,1) both; }
        .fade-up-2 { animation: fade-up 0.9s 0.15s cubic-bezier(0.16,1,0.3,1) both; }
        .fade-up-3 { animation: fade-up 0.9s 0.3s cubic-bezier(0.16,1,0.3,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .fade-up, .fade-up-2, .fade-up-3 { animation: none; }
        }
      `}</style>

      <div style={{
        minHeight: '100vh', background: '#050210',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}>

        {/* Constellation canvas */}
        <canvas ref={canvasRef} style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
        }} />

        {/* Ambient glow behind logo */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(90,20,200,0.18) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }} />

        {/* Content */}
        <div style={{ position: 'relative', textAlign: 'center', padding: '0 24px' }}>

          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="fade-up"
            src="/assets/branding/void-favicon.png"
            alt="VOID Pack"
            style={{ width: 64, height: 64, margin: '0 auto 20px', display: 'block', filter: 'drop-shadow(0 0 20px rgba(90,20,200,0.5))' }}
          />

          <p className="fade-up" style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'rgba(167,139,250,0.4)',
            marginBottom: 14,
          }}>VOID Pack</p>

          <h1 className="fade-up-2" style={{
            fontSize: 28, fontWeight: 900, color: '#fff',
            letterSpacing: '-0.02em', lineHeight: 1.15,
            marginBottom: 12,
          }}>
            Maintenance en cours
          </h1>

          <p className="fade-up-3" style={{
            fontSize: 14, color: 'rgba(255,255,255,0.3)',
            lineHeight: 1.65, maxWidth: 260, margin: '0 auto',
          }}>
            On revient très vite...
          </p>
        </div>
      </div>
    </>
  )
}
