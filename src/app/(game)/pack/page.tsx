'use client'
import { PackScreen } from '@/components/game/PackScreen'
import { FeatureGate } from '@/components/FeatureGate'

export default function PackPage() {
  return (
    <FeatureGate featureKey="feature_pack_opening" label="L'ouverture de packs">
      <div className="overflow-hidden -mb-28">
        <PackScreen />
      </div>
    </FeatureGate>
  )
}
