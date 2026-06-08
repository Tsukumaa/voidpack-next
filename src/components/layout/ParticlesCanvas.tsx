'use client'
import { useEffect, useRef } from 'react'

export function ParticlesCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    let W = window.innerWidth
    let H = window.innerHeight
    canvas.width  = W
    canvas.height = H

    const onResize = () => {
      W = canvas.width  = window.innerWidth
      H = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', onResize)

    const rand  = (a: number, b: number) => a + Math.random() * (b - a)
    const randI = (a: number, b: number) => Math.floor(rand(a, b))

    // Stars
    const stars = Array.from({ length: 120 }, () => ({
      x: rand(0, W), y: rand(0, H),
      size: rand(.4, 2.2), alpha: rand(.15, .85),
      vx: rand(-.06, .06), vy: rand(.02, .12),
      pulse: rand(0, Math.PI * 2), pulseSpeed: rand(.005, .016),
      purple: Math.random() > .45,
    }))

    // Embers
    const embers = Array.from({ length: 55 }, () => ({
      x: rand(0, W), y: rand(H * .4, H),
      size: rand(.8, 2.8), alpha: rand(.4, .9),
      vx: rand(-.45, .45), vy: rand(-.85, -.18),
      wobble: rand(0, Math.PI * 2), wobbleSpd: rand(.018, .055),
      wobbleAmp: rand(.15, .55), life: rand(.2, 1),
      decay: rand(.0025, .007), vy_acc: .008,
      r: randI(140, 200), g: randI(20, 80),
      trail: [] as Array<{ x: number; y: number; a: number }>,
    }))

    let animId: number
    function loop() {
      ctx.clearRect(0, 0, W, H)

      // Stars
      stars.forEach(s => {
        s.x += s.vx; s.y += s.vy; s.pulse += s.pulseSpeed
        if (s.y > H + 10) { s.y = -10; s.x = rand(0, W) }
        const a = s.alpha * (.6 + .4 * Math.sin(s.pulse))
        const color = s.purple ? `rgba(${randI(180,220)},${randI(140,180)},255,` : 'rgba(255,255,255,'
        ctx.save()
        ctx.globalAlpha = a * .35
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 3.5)
        g.addColorStop(0, color + '1)'); g.addColorStop(1, color + '0)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(s.x, s.y, s.size * 3.5, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = a
        ctx.fillStyle = color + '1)'
        ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      })

      // Embers
      embers.forEach(e => {
        e.trail.push({ x: e.x, y: e.y, a: e.life * e.alpha })
        if (e.trail.length > 8) e.trail.shift()
        e.wobble += e.wobbleSpd
        e.vx += Math.sin(e.wobble) * e.wobbleAmp * .08
        e.vx *= .98; e.vy -= e.vy_acc
        e.x += e.vx; e.y += e.vy; e.life -= e.decay
        if (e.life <= 0) {
          Object.assign(e, {
            x: rand(0, W), y: H + rand(5, 20),
            vx: rand(-.45, .45), vy: rand(-.85, -.18),
            life: rand(.4, 1), trail: [],
          })
        }
        const a = e.life * e.alpha
        ctx.save()
        ctx.globalAlpha = a * .45
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.size * 5)
        g.addColorStop(0, `rgba(${e.r},${e.g},255,.9)`)
        g.addColorStop(1, `rgba(${e.r},${e.g},255,0)`)
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(e.x, e.y, e.size * 5, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = a
        ctx.fillStyle = `rgb(${e.r},${e.g},255)`
        ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      })

      animId = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-[1]"
    />
  )
}
