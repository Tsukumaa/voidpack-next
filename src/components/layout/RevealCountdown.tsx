'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { ConstellationBg } from './ConstellationBg'

type Phase = 'countdown' | 'video' | 'done'

function pad(n: number) { return String(Math.floor(n)).padStart(2, '0') }

export function RevealCountdown({ revealDate }: { revealDate: string }) {
  const target = useRef(new Date(revealDate).getTime())
  const [phase, setPhase] = useState<Phase>(() =>
    Date.now() >= target.current ? 'done' : 'countdown'
  )
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0 })
  const videoRef = useRef<HTMLVideoElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const triggerReveal = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setPhase('video')
    const v = videoRef.current
    if (v) { v.currentTime = 0; v.play().catch(() => {}) }
  }, [])

  useEffect(() => {
    if (phase !== 'countdown') return
    const tick = () => {
      const diff = target.current - Date.now()
      if (diff <= 0) { triggerReveal(); return }
      setTimeLeft({
        d: diff / 86400000,
        h: (diff % 86400000) / 3600000,
        m: (diff % 3600000) / 60000,
        s: (diff % 60000) / 1000,
      })
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [phase, triggerReveal])

  // Passé → pas d'overlay
  if (phase === 'done') return null

  return (
    <>
      <style>{`
        @keyframes rv-glow { 0%,100%{filter:drop-shadow(0 0 12px rgba(123,43,255,.5))} 50%{filter:drop-shadow(0 0 28px rgba(123,43,255,.9))} }
        @keyframes rv-in { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .rv-logo  { animation: rv-glow 3s ease-in-out infinite }
        .rv-a     { animation: rv-in .8s cubic-bezier(.16,1,.3,1) both }
        .rv-b     { animation: rv-in .8s .1s cubic-bezier(.16,1,.3,1) both }
        .rv-c     { animation: rv-in .8s .2s cubic-bezier(.16,1,.3,1) both }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#050210', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      }}>

        {/* Vidéo */}
        <video
          ref={videoRef}
          src="/assets/void-reveal.mp4"
          playsInline
          onEnded={() => setPhase('done')}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', zIndex: 10,
            display: phase === 'video' ? 'block' : 'none',
          }}
        />

        {/* Constellation + countdown */}
        {phase === 'countdown' && (
          <>
            <ConstellationBg />
            <div style={{ position: 'relative', zIndex: 5, textAlign: 'center', padding: '0 24px', maxWidth: 480, width: '100%' }}>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="rv-logo rv-a"
                src="/assets/branding/void-favicon.png"
                alt="VOID Pack"
                style={{ width: 60, height: 60, display: 'block', margin: '0 auto 24px' }}
              />

              <p className="rv-a" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.45)', marginBottom: 10 }}>
                VOID Pack
              </p>
              <h1 className="rv-b" style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', marginBottom: 6 }}>
                Bientôt disponible
              </h1>
              <p className="rv-b" style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', marginBottom: 44 }}>
                Quelque chose arrive...
              </p>

              {/* Countdown */}
              <div className="rv-c" style={{ display: 'flex', gap: 0, justifyContent: 'center', alignItems: 'flex-start' }}>
                {[
                  { val: timeLeft.d, label: 'JOURS' },
                  { val: timeLeft.h, label: 'HEURES' },
                  { val: timeLeft.m, label: 'MIN' },
                  { val: timeLeft.s, label: 'SEC' },
                ].map(({ val, label }, i) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'flex-start' }}>
                    {i > 0 && (
                      <span style={{ fontSize: 44, fontWeight: 900, color: 'rgba(167,139,250,0.2)', lineHeight: 1, padding: '0 6px', marginTop: 2 }}>:</span>
                    )}
                    <div style={{ textAlign: 'center', minWidth: 72 }}>
                      <div style={{
                        fontSize: 56, fontWeight: 900, color: '#fff', lineHeight: 1,
                        letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums',
                        textShadow: '0 0 32px rgba(123,43,255,0.45)',
                      }}>
                        {pad(val)}
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(167,139,250,0.35)', marginTop: 8 }}>
                        {label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
