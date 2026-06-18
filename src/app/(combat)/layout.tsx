import { AuthProvider } from '@/components/layout/AuthProvider'

export default function CombatGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="fixed inset-0 overflow-hidden" style={{ background: '#06010e' }}>
        {children}
      </div>
    </AuthProvider>
  )
}
