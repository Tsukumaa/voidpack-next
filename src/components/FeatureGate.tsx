'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getFeatures } from '@/hooks/useFeatures'

interface Props {
  featureKey: string
  children: React.ReactNode
  label?: string
}

export function FeatureGate({ featureKey, children, label = 'Cette fonctionnalité' }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    getFeatures()
      .then((data) => setEnabled(featureKey in data ? data[featureKey] : true))
      .catch(() => setEnabled(true))
  }, [featureKey])

  if (enabled === null) return null

  if (!enabled) {
    return (
      <div style={{
        minHeight: '100vh', background: '#06010e', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 16, padding: 24, fontFamily: 'system-ui, sans-serif', color: '#f6f1ff',
      }}>
        <span style={{ fontSize: 48 }}>🔒</span>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{label} est désactivé</h2>
        <p style={{ color: 'rgba(246,241,255,0.45)', fontSize: 14, margin: 0, textAlign: 'center' }}>
          Cette section est temporairement indisponible.<br />Reviens dans quelques instants.
        </p>
        <button
          onClick={() => router.back()}
          style={{ marginTop: 8, padding: '10px 24px', borderRadius: 12, background: 'rgba(123,43,255,0.15)', border: '1px solid rgba(123,43,255,0.3)', color: '#b97cff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          ← Retour
        </button>
      </div>
    )
  }

  return <>{children}</>
}
