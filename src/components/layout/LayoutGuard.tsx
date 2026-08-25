import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { settings, playerProfiles } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { ConstellationBgLazy } from './ConstellationBgLazy'
import { RevealCountdownLazy } from './RevealCountdownLazy'
import { BanAppealFormLazy } from './BanAppealFormLazy'
import { ShieldX } from 'lucide-react'

const getCachedSettings = unstable_cache(
  async () => {
    const rows = await db.select().from(settings)
      .where(inArray(settings.key, ['maintenance_mode', 'reveal_date']))
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value
    return map
  },
  ['layout-settings'],
  { revalidate: 30 }
)

export async function LayoutGuard() {
  const [session, s] = await Promise.all([auth(), getCachedSettings()])
  const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin

  if (s['reveal_date']) {
    const revealDate = new Date(s['reveal_date'])
    if (!isNaN(revealDate.getTime()) && revealDate.getTime() > Date.now()) {
      return <RevealCountdownLazy revealDate={revealDate.toISOString()} />
    }
  }

  if (s['maintenance_mode'] === 'true' && !isAdmin) {
    return (
      <>
        <style>{`
          @keyframes mo-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          @keyframes mo-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
          .mo-spin { animation: mo-spin 1.4s linear infinite }
          .mo-card { animation: mo-fade .7s cubic-bezier(.16,1,.3,1) both }
        `}</style>
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'#050210', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', padding:24, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
          <ConstellationBgLazy />
          <div className="mo-card" style={{ position:'relative', width:'100%', maxWidth:340, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:24, padding:'32px 28px', textAlign:'center', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/branding/void-favicon.png" alt="VOID Pack" style={{ width:52, height:52, display:'block', margin:'0 auto 16px', filter:'drop-shadow(0 0 14px rgba(123,43,255,0.7))' }} />
            <p style={{ fontSize:10, fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase', color:'rgba(167,139,250,0.4)', marginBottom:8 }}>VOID Pack</p>
            <h1 style={{ fontSize:22, fontWeight:900, color:'#fff', letterSpacing:'-0.02em', lineHeight:1.15, marginBottom:8 }}>Maintenance en cours</h1>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.3)', lineHeight:1.65, marginBottom:28 }}>On revient très vite...</p>
            <div style={{ display:'flex', justifyContent:'center' }}>
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

  if (session?.user?.id) {
    const [profile] = await db
      .select({ isBanned: playerProfiles.isBanned, banReason: playerProfiles.banReason, banAppeal: playerProfiles.banAppeal })
      .from(playerProfiles)
      .where(eq(playerProfiles.userId, session.user.id))
      .limit(1)

    if (profile?.isBanned) {
      return (
        <>
          <style>{`
            @keyframes bo-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
            .bo-card { animation: bo-fade .5s cubic-bezier(.16,1,.3,1) both }
          `}</style>
          <div style={{ position:'fixed', inset:0, zIndex:9999, background:'#050210', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', padding:24, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
            <ConstellationBgLazy />
            <div className="bo-card" style={{ position:'relative', width:'100%', maxWidth:380, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(220,30,30,0.25)', borderRadius:24, padding:'32px 28px', textAlign:'center', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)' }}>
              <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(220,30,30,0.15)', border:'1px solid rgba(220,30,30,0.3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <ShieldX size={24} color="#fca5a5" />
              </div>
              <p style={{ fontSize:10, fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase', color:'rgba(255,100,100,0.5)', marginBottom:8 }}>VOID Pack</p>
              <h1 style={{ fontSize:22, fontWeight:900, color:'#fff', letterSpacing:'-0.02em', lineHeight:1.2, marginBottom:12 }}>Compte banni</h1>
              {profile.banReason && (
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'10px 14px', marginBottom:20, lineHeight:1.6, textAlign:'left' }}>
                  <span style={{ color:'rgba(255,100,100,0.6)', fontWeight:600, display:'block', marginBottom:4 }}>Raison</span>
                  {profile.banReason}
                </div>
              )}
              <BanAppealFormLazy hasAppeal={!!profile.banAppeal} />
            </div>
          </div>
        </>
      )
    }
  }

  return null
}
