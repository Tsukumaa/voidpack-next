import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { ConstellationBgLazy } from './ConstellationBgLazy'

async function getMaintenanceMode(): Promise<boolean> {
  try {
    const row = await db.select().from(settings).where(eq(settings.key, 'maintenance_mode')).limit(1).then(r => r[0])
    return row?.value === 'true'
  } catch {
    return false
  }
}

export async function MaintenanceOverlay() {
  const [session, maintenance] = await Promise.all([auth(), getMaintenanceMode()])
  if (!maintenance) return null
  const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin
  if (isAdmin) return null

  return (
    <>
      <style>{`
        @keyframes mo-ta { 0%,100%{opacity:.2} 50%{opacity:.8} }
        @keyframes mo-tb { 0%,100%{opacity:.5} 50%{opacity:.12} }
        @keyframes mo-tc { 0%,100%{opacity:.12} 60%{opacity:.65} }
        @keyframes mo-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes mo-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .mo-ta { animation: mo-ta 3.1s ease-in-out infinite }
        .mo-tb { animation: mo-tb 4.4s ease-in-out infinite }
        .mo-tc { animation: mo-tc 2.7s ease-in-out infinite }
        .mo-spin { animation: mo-spin 1.4s linear infinite }
        .mo-card { animation: mo-fade .7s cubic-bezier(.16,1,.3,1) both }
        @media(prefers-reduced-motion:reduce){
          .mo-ta,.mo-tb,.mo-tc,.mo-spin{animation:none}
        }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#050210',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        overflow: 'hidden',
        padding: 24,
      }}>

        <ConstellationBgLazy />

        {/* Card — même style que le reste du site */}
        <div className="mo-card" style={{
          position: 'relative',
          width: '100%', maxWidth: 340,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 24,
          padding: '32px 28px',
          textAlign: 'center',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}>

          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/branding/void-favicon.png" alt="VOID Pack" style={{
            width: 52, height: 52, display: 'block', margin: '0 auto 16px',
            filter: 'drop-shadow(0 0 14px rgba(123,43,255,0.7))',
          }} />

          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
            textTransform: 'uppercase', color: 'rgba(167,139,250,0.4)',
            marginBottom: 8,
          }}>VOID Pack</p>

          <h1 style={{
            fontSize: 22, fontWeight: 900, color: '#fff',
            letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 8,
          }}>Maintenance en cours</h1>

          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,0.3)',
            lineHeight: 1.65, marginBottom: 28,
          }}>
            On revient très vite...
          </p>

          {/* Loader */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <svg className="mo-spin" width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="9" stroke="rgba(123,43,255,0.15)" strokeWidth="2.5" />
              <path d="M11 2 A9 9 0 0 1 20 11" stroke="rgba(167,139,250,0.7)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
    </>
  )
}
