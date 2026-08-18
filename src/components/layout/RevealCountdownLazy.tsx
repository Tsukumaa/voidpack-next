'use client'
import dynamic from 'next/dynamic'

const RevealCountdown = dynamic(
  () => import('./RevealCountdown').then(m => m.RevealCountdown),
  { ssr: false }
)

export function RevealCountdownLazy({ revealDate }: { revealDate: string }) {
  return <RevealCountdown revealDate={revealDate} />
}
