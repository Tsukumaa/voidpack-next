'use client'
import dynamic from 'next/dynamic'

const BanAppealForm = dynamic(
  () => import('./BanAppealForm').then(m => m.BanAppealForm),
  { ssr: false }
)

export function BanAppealFormLazy({ hasAppeal }: { hasAppeal: boolean }) {
  return <BanAppealForm hasAppeal={hasAppeal} />
}
