'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGameStore } from '@/store/game'
import { ACHIEVEMENTS, DAILY_MISSIONS, getTodayMissions } from '@/lib/game/achievements'

const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#b86dff',
  rare: '#4aa3ff', uncommon: '#22c55e', common: '#9ca3af',
}

function xpForLevel(lvl: number) {
  return Math.floor(200 * Math.pow(1.18, lvl - 1))
}

function getLevelProgress(xp: number, level: number) {
  let cumulative = 0
  for (let i = 1; i < level; i++) cumulative += xpForLevel(i)
  const needed = xpForLevel(level)
  const inLevel = xp - cumulative
  return { current: Math.max(0, inLevel), needed, progress: Math.min(100, Math.max(0, Math.round((inLevel / needed) * 100))) }
}

interface DailyReward {
  last_claim_at: string | null
  current_streak: number
  best_streak: number
}

interface MissionProgress {
  mission_id: string
  progress: number
  completed: boolean
  xp_claimed: boolean
}

export default function ProfilPage() {
  const { user, profile, setProfile } = useGameStore(s => ({ user: s.user, profile: s.profile, setProfile: s.setProfile }))
  const [stats, setStats]               = useState<{ totalCards: number; uniqueCards: number; byRarity: Record<string, number> } | null>(null)
  const [daily, setDaily]               = useState<DailyReward | null>(null)
  const [achievements, setAchievements] = useState<string[]>([])
  const [missions, setMissions]         = useState<MissionProgress[]>([])
  const [claiming, setClaiming]         = useState(false)
  const [claimMsg, setClaimMsg]         = useState('')
  const [activeTab, setActiveTab]       = useState<'overview'|'missions'|'achievements'>('overview')
  const [claimingMission, setClaimingMission] = useState<string | null>(null)

  const todayMissions = getTodayMissions()

  const load = useCallback(async () => {
    if (!user) return
    const sb = createClient()

    const [cardsRes, drRes, achRes, missRes] = await Promise.all([
      sb.from('player_cards').select('card_id, rarity').eq('user_id', user.id),
      sb.from('player_daily_rewards').select('last_claim_at, current_streak, best_streak').eq('user_id', user.id).single(),
      sb.from('player_achievements').select('achievement_id').eq('user_id', user.id),
      sb.from('player_daily_missions').select('mission_id, progress, completed, xp_claimed').eq('user_id', user.id).eq('date', new Date().toISOString().split('T')[0]),
    ])

    if (cardsRes.data) {
      const byRarity: Record<string, number> = {}
      const unique = new Set<string>()
      for (const c of cardsRes.data) {
        byRarity[c.rarity] = (byRarity[c.rarity] ?? 0) + 1
        unique.add(c.card_id)
      }
      setStats({ totalCards: cardsRes.data.length, uniqueCards: unique.size, byRarity })
    }
    setDaily(drRes.data)
    setAchievements((achRes.data ?? []).map(a => a.achievement_id))
    setMissions(missRes.data ?? [])
  }, [user])

  useEffect(() => { load() }, [load])

  function linkTwitch() {
    const TWITCH_CLIENT_ID = 'cqxwy2c8tbocyx5lsbzi2iblgyow5j'
    const redirectUri = `${window.location.origin}/twitch-callback.html`
    const state = Math.random().toString(36).slice(2)
    sessionStorage.setItem('twitch_oauth_state', state)
    const url = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=user:read:email&state=${state}`
    window.location.href = url
  }

  async function unlinkTwitch() {
    await createClient().rpc('unlink_twitch_account')
    if (profile) setProfile({ ...profile, twitch_login: null })
  }

  async function claimDaily() {
    if (claiming) return
    setClaiming(true)
    try {
      const { error } = await createClient().rpc('claim_daily_reward')
      if (error) throw error
      setClaimMsg('✅ Booster crédité !')
      load()
    } catch { setClaimMsg('Déjà réclamé aujourd\'hui.') }
    finally { setClaiming(false); setTimeout(() => setClaimMsg(''), 3000) }
  }

  async function claimMission(missionId: string) {
    setClaimingMission(missionId)
    try {
      const { data } = await createClient().rpc('claim_mission_reward', { p_mission_id: missionId })
      if (data?.xp_gained && profile) {
        setProfile({ ...profile, xp: (profile.xp ?? 0) + data.xp_gained })
      }
      load()
    } catch(e) { console.error(e) }
    finally { setClaimingMission(null) }
  }

  const canClaim = daily?.last_claim_at
    ? new Date().getTime() - new Date(daily.last_claim_at).getTime() > 20 * 3600 * 1000
    : true

  const level = profile?.level ?? 1
  const xp    = profile?.xp ?? 0
  const { current: xpCurrent, needed: xpNeeded, progress } = getLevelProgress(xp, level)
  const unlockedCount = achievements.length
  const completedMissions = missions.filter(m => m.completed).length

  if (!user) return (
    <div className="flex items-center justify-center min-h-[50vh] text-white/30 text-sm">
      Connecte-toi pour voir ton profil.
    </div>
  )

  return (
    <div className="pb-4 space-y-4">

      {/* Header */}
      <div className="flex items-center gap-4 pt-2">
        <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 border border-white/10"
          style={profile?.avatar_url ? { backgroundImage:`url(${profile.avatar_url})`, backgroundSize:'cover' } : { background:'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
          {!profile?.avatar_url && (
            <div className="w-full h-full flex items-center justify-center text-xl font-black text-white">
              {profile?.username?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-white text-lg truncate">{profile?.username ?? 'Joueur'}</p>
          <p className="text-[#a78bfa] text-sm font-bold">Niveau {level}</p>
        </div>
        {profile?.highest_rarity && (
          <div className="px-3 py-1.5 rounded-xl text-xs font-bold capitalize"
            style={{ background: RARITY_COLOR[profile.highest_rarity]+'20', color: RARITY_COLOR[profile.highest_rarity] }}>
            {profile.highest_rarity}
          </div>
        )}
      </div>

      {/* XP bar */}
      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-white/60 text-xs font-bold uppercase tracking-wider">Expérience</span>
          <span className="text-white/50 text-xs">{xpCurrent.toLocaleString('fr-FR')} / {xpNeeded.toLocaleString('fr-FR')} XP</span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width:`${progress}%`, background:'linear-gradient(90deg,#7b2bff,#a855f7)' }} />
        </div>
        <p className="text-white/30 text-xs">{xp.toLocaleString('fr-FR')} XP total</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        {([
          { id: 'overview',     label: '📊 Vue d\'ensemble' },
          { id: 'missions',     label: `🎯 Missions ${completedMissions > 0 ? `(${completedMissions}/${todayMissions.length})` : ''}` },
          { id: 'achievements', label: `🏆 Succès (${unlockedCount})` },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-[#7b2bff] text-white' : 'text-white/40 hover:text-white/60'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          {/* Twitch link */}
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: 'rgba(145,71,255,0.15)' }}>
                  📺
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Compte Twitch</p>
                  {profile?.twitch_login ? (
                    <p className="text-[#00c896] text-xs mt-0.5">Lié à {profile.twitch_login}</p>
                  ) : (
                    <p className="text-white/40 text-xs mt-0.5">Lie ton compte pour recevoir des boosters</p>
                  )}
                </div>
              </div>
              {profile?.twitch_login ? (
                <button onClick={unlinkTwitch}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/50 text-xs font-bold transition-colors">
                  Délier
                </button>
              ) : (
                <button onClick={linkTwitch}
                  className="px-3 py-1.5 rounded-xl text-white text-xs font-bold transition-all"
                  style={{ background: 'linear-gradient(135deg,#9147ff,#5a1fb8)' }}>
                  Lier
                </button>
              )}
            </div>
          </div>

          {/* Daily reward */}
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-white font-bold text-sm">Récompense quotidienne</p>
                <p className="text-white/40 text-xs mt-0.5">
                  🔥 Streak : <span className="text-[#ff9a3d] font-bold">{daily?.current_streak ?? 0}j</span>
                  {daily?.best_streak ? <span className="ml-2 text-white/30">· Record : {daily.best_streak}j</span> : null}
                </p>
              </div>
              <button onClick={claimDaily} disabled={!canClaim || claiming}
                className="px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                style={canClaim ? { background:'linear-gradient(135deg,#7b2bff,#4a1fa8)', color:'white' } : { background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.3)' }}>
                {claiming ? '…' : canClaim ? 'Réclamer' : '✓ Fait'}
              </button>
            </div>
            {claimMsg && <p className="text-xs text-[#00c896]">{claimMsg}</p>}
            <div className="flex gap-1.5 mt-2">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="flex-1 h-1.5 rounded-full"
                  style={{ background: i < (daily?.current_streak ?? 0) ? '#ff9a3d' : 'rgba(255,255,255,0.08)' }} />
              ))}
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4">
              <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3">Collection</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <p className="text-white font-black text-xl">{stats.totalCards}</p>
                  <p className="text-white/40 text-xs">Cartes total</p>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <p className="text-white font-black text-xl">{stats.uniqueCards}</p>
                  <p className="text-white/40 text-xs">Uniques</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {['void','legendary','epic','rare','common'].filter(r => stats.byRarity[r]).map(r => (
                  <div key={r} className="flex items-center gap-2">
                    <span className="w-16 text-xs capitalize" style={{ color: RARITY_COLOR[r] }}>{r}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width:`${(stats.byRarity[r]/stats.totalCards)*100}%`, background: RARITY_COLOR[r] }} />
                    </div>
                    <span className="text-white/40 text-xs w-6 text-right">{stats.byRarity[r]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Missions ── */}
      {activeTab === 'missions' && (
        <div className="space-y-3">
          <p className="text-white/40 text-xs">Missions du jour — reset à minuit</p>
          {todayMissions.map(mission => {
            const prog = missions.find(m => m.mission_id === mission.id)
            const current = prog?.progress ?? 0
            const completed = prog?.completed ?? (current >= mission.goal)
            const claimed = prog?.xp_claimed ?? false
            const pct = Math.min(100, (current / mission.goal) * 100)
            return (
              <div key={mission.id} className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{mission.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white font-bold text-sm">{mission.label}</p>
                      <span className="text-[#a78bfa] text-xs font-bold flex-shrink-0">+{mission.xp} XP</span>
                    </div>
                    <p className="text-white/40 text-xs mt-0.5">{mission.desc}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width:`${pct}%`, background: completed ? '#00c896' : 'linear-gradient(90deg,#7b2bff,#a855f7)' }} />
                      </div>
                      <span className="text-white/40 text-xs flex-shrink-0">{Math.min(current, mission.goal)}/{mission.goal}</span>
                    </div>
                  </div>
                </div>
                {completed && !claimed && (
                  <button onClick={() => claimMission(mission.id)}
                    disabled={claimingMission === mission.id}
                    className="mt-3 w-full py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                    style={{ background:'linear-gradient(135deg,#00c896,#00a878)' }}>
                    {claimingMission === mission.id ? '…' : `Réclamer +${mission.xp} XP`}
                  </button>
                )}
                {claimed && (
                  <p className="mt-2 text-xs text-[#00c896] text-center">✅ Récompense réclamée</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Succès ── */}
      {activeTab === 'achievements' && (
        <div className="space-y-2">
          <p className="text-white/40 text-xs">{unlockedCount}/{ACHIEVEMENTS.length} succès débloqués</p>
          <div className="grid grid-cols-1 gap-2">
            {ACHIEVEMENTS.map(a => {
              const unlocked = achievements.includes(a.id)
              return (
                <div key={a.id}
                  className="flex items-center gap-3 p-3 rounded-2xl border transition-all"
                  style={{
                    background: unlocked ? 'rgba(123,43,255,0.08)' : 'rgba(255,255,255,0.02)',
                    border: unlocked ? '1px solid rgba(123,43,255,0.25)' : '1px solid rgba(255,255,255,0.05)',
                    opacity: unlocked ? 1 : 0.45,
                  }}>
                  <span className="text-2xl flex-shrink-0">{a.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm">{a.label}</p>
                    <p className="text-white/40 text-xs truncate">{a.desc}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {unlocked
                      ? <span className="text-[#00c896] text-xs font-bold">✓</span>
                      : <span className="text-[#a78bfa] text-xs">+{a.xp} XP</span>
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
