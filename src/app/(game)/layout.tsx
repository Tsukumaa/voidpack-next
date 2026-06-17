import { StatusBar } from '@/components/layout/StatusBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ParticlesCanvas } from '@/components/layout/ParticlesCanvas'
import { AuthProvider } from '@/components/layout/AuthProvider'
import { AdminFab } from '@/components/layout/AdminFab'
import { GlobalOverlay } from '@/components/layout/GlobalOverlay'

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ParticlesCanvas />

      <div className="flex flex-col min-h-svh">
        <StatusBar />

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 lg:px-12 pb-28 pt-0">
          {children}
        </main>

        <BottomNav />
        <AdminFab />
        <GlobalOverlay />
      </div>
    </AuthProvider>
  )
}
