import type { Metadata, Viewport } from 'next'
import { Inter, Cinzel } from 'next/font/google'
import { Providers } from '@/components/layout/Providers'
import { MusicPlayer } from '@/components/layout/MusicPlayer'
import { SettingsButton } from '@/components/layout/SettingsButton'
import './globals.css'

const inter  = Inter({ subsets: ['latin'], variable: '--font-inter' })
const cinzel = Cinzel({ subsets: ['latin'], weight: ['400','600','700','900'], variable: '--font-cinzel' })

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
    <html lang="fr" className={`${inter.variable} ${cinzel.variable}`}>
      <body className="font-sans bg-[#06010e] text-[#f6f1ff] min-h-svh overflow-x-hidden antialiased">
        {/* Fond image fixe */}
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            background: 'linear-gradient(rgba(3,3,8,.62),rgba(3,3,8,.62)), url(/assets/bg-void.png) center/cover no-repeat',
          }}
        />
        {/* Rochers flottants */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/rochers.png"
          alt=""
          aria-hidden="true"
          className="fixed inset-0 w-full h-full object-cover z-[1] pointer-events-none animate-[rockFloat_11s_ease-in-out_infinite]"
        />
        {/* Contenu */}
        <div className="relative z-[2]">
          <Providers>{children}</Providers>
        </div>
        <MusicPlayer />
        <SettingsButton />
      </body>
    </html>
  )
}
