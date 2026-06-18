import { AuthProvider } from '@/components/layout/AuthProvider'

export default function CombatGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  )
}
