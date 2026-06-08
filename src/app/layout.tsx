import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'VOID Pack',
  description: 'Ouvre des boosters. Révèle tes cartes. Affronte tes amis.',
  icons: { icon: '/assets/branding/void-favicon.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#06010e',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="bg-void-bg text-void-text min-h-svh overflow-x-hidden antialiased">
        {/* Fond image fixe */}
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            background: 'linear-gradient(rgba(3,3,8,.62),rgba(3,3,8,.62)), url(/assets/bg-void.png) center/cover no-repeat',
          }}
        />
        {/* Rochers flottants */}
        <img
          src="/assets/rochers.png"
          alt=""
          aria-hidden
          className="fixed inset-0 w-full h-full object-cover z-[1] pointer-events-none animate-rock-float"
        />
        {/* Contenu */}
        <div className="relative z-[2]">
          {children}
        </div>
      </body>
    </html>
  )
}
