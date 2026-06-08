import { StatusBar } from '@/components/layout/StatusBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ParticlesCanvas } from '@/components/layout/ParticlesCanvas'
import { AuthProvider } from '@/components/layout/AuthProvider'

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {/* Particules canvas par-dessus le fond */}
      <ParticlesCanvas />

      <div className="flex flex-col min-h-svh">
        {/* Status bar */}
        <StatusBar />

        {/* Contenu principal centré */}
        <main className="flex-1 w-full max-w-[520px] mx-auto px-4 pb-28 pt-4">
          {children}
        </main>

        {/* Bottom nav */}
        <BottomNav />
      </div>
    </AuthProvider>
  )
}
