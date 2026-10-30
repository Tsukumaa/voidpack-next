import { AuthProvider } from '@/components/layout/AuthProvider'
import { GlobalOverlay } from '@/components/layout/GlobalOverlay'
import { SettingsButton } from '@/components/layout/SettingsButton'

export default function CombatGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <GlobalOverlay />
      {/* Pas de header en combat : bouton paramètres flottant */}
      <SettingsButton />
    </AuthProvider>
  )
}
