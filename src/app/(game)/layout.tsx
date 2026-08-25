import Link from 'next/link'
import { StatusBar } from '@/components/layout/StatusBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ParticlesCanvas } from '@/components/layout/ParticlesCanvas'
import { AuthProvider } from '@/components/layout/AuthProvider'
import { GlobalOverlay } from '@/components/layout/GlobalOverlay'
import { CookieBanner } from '@/components/layout/CookieBanner'
import { LayoutGuard } from '@/components/layout/LayoutGuard'

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LayoutGuard />
      <ParticlesCanvas />

      <div className="flex flex-col min-h-svh">
        <StatusBar />

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 lg:px-12 pb-28 pt-0">
          {children}
        </main>

        <footer className="fixed bottom-[88px] left-0 right-0 flex flex-col items-center gap-1.5 z-40 pointer-events-none">
          <div className="flex gap-4 text-[11px] text-white/20">
            <Link href="/mentions-legales" className="hover:text-white/50 transition-colors pointer-events-auto">Mentions légales</Link>
            <span className="text-white/10">·</span>
            <Link href="/cgu" className="hover:text-white/50 transition-colors pointer-events-auto">CGU</Link>
            <span className="text-white/10">·</span>
            <Link href="/confidentialite" className="hover:text-white/50 transition-colors pointer-events-auto">Confidentialité</Link>
          </div>
          <p className="text-[10px] text-white/30">Site développé par tsu_kuma &amp; b_alvd</p>
        </footer>

        <CookieBanner />
        <BottomNav />
        <GlobalOverlay />
      </div>
    </AuthProvider>
  )
}
