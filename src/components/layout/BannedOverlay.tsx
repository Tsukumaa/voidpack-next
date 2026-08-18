import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { ShieldX } from 'lucide-react'
import { ConstellationBgLazy } from './ConstellationBgLazy'
import { BanAppealFormLazy } from './BanAppealFormLazy'

export async function BannedOverlay() {
  const session = await auth()
  if (!session?.user?.id) return null

  const [profile] = await db
    .select({ isBanned: playerProfiles.isBanned, banReason: playerProfiles.banReason, banAppeal: playerProfiles.banAppeal })
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, session.user.id))
    .limit(1)

  if (!profile?.isBanned) return null

  return (
    <>
      <style>{`
        @keyframes bo-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .bo-card { animation: bo-fade .5s cubic-bezier(.16,1,.3,1) both }
      `}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#050210', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        padding: 24,
      }}>
        <ConstellationBgLazy />

        <div className="bo-card" style={{
          width: '100%', maxWidth: 380,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(220,30,30,0.25)',
          borderRadius: 24,
          padding: '32px 28px',
          textAlign: 'center',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(220,30,30,0.15)',
            border: '1px solid rgba(220,30,30,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <ShieldX size={24} color="#fca5a5" />
          </div>

          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,100,100,0.5)', marginBottom: 8 }}>
            VOID Pack
          </p>

          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 12 }}>
            Compte banni
          </h1>

          {profile.banReason && (
            <div style={{
              fontSize: 13, color: 'rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12, padding: '10px 14px',
              marginBottom: 20, lineHeight: 1.6,
              textAlign: 'left',
            }}>
              <span style={{ color: 'rgba(255,100,100,0.6)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Raison</span>
              {profile.banReason}
            </div>
          )}

          {/* Formulaire appeal + déconnexion — client uniquement */}
          <BanAppealFormLazy hasAppeal={!!profile.banAppeal} />
        </div>
      </div>
    </>
  )
}
