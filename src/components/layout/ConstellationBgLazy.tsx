'use client'
import dynamic from 'next/dynamic'

const ConstellationBg = dynamic(() => import('./ConstellationBg').then(m => m.ConstellationBg), { ssr: false })

export function ConstellationBgLazy() {
  return <ConstellationBg />
}
