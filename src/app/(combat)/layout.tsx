import { AuthProvider } from '@/components/layout/AuthProvider'
import { GlobalOverlay } from '@/components/layout/GlobalOverlay'

export default function CombatGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <GlobalOverlay />
    </AuthProvider>
  )
}
