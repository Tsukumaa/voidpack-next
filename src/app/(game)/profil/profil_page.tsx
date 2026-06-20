'use client'
import { useState, useEffect, useCallback } from 'react'
import { useGameStore } from '@/store/game'
import { useSocialStore } from '@/store/social'
import { ACHIEVEMENTS, getTodayMissions } from '@/lib/game/achievements'
import { getMissionProgress, getClaimedMissions, markMissionClaimed, trackMissionProgress } from '@/lib/game/mission-tracker'

const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#ec4899',
  rare: '#4aa3ff', common: '#9ca3af',
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
  const addToast = useSocialStore(s => s.addToast)
  const [stats, setStats]               = useState<{ totalCards: number; uniqueCards: number; byRarity: Record<string, number> } | null>(null)
  const [daily, setDaily]               = useState<DailyReward | null>(null)
  const [achievements, setAchievements] = useState<string[]>([])
  const [missions, setMissions]         = useState<MissionProgress[]>([])
  const [claiming, setClaiming]         = useState(false)
  const [claimMsg, setClaimMsg]         = useState('')
  const [activeTab, setActiveTab]       = useState<'overview'|'missions'|'achievements'>('overview')
  const [claimingMission, setClaimingMission] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const todayMissions = getTodayMissions()

  const load = useCallback(async () => {
    if (!user) return

    const [cardsRes, streakRes, achRes] = await Promise.all([
      fetch('/api/collection').then(r => r.json()).catch(() => ({ cards: [] })),
      fetch('/api/profile/streak').then(r => r.json()).catch(() => null),
      fetch('/api/achievements').then(r => r.json()).catch(() => []),
    ])

    const cardsList = Array.isArray(cardsRes) ? cardsRes : (cardsRes?.cards ?? [])
    if (cardsList.length >= 0) {
      const byRarity: Record<string, number> = {}
      let totalCards = 0
      for (const c of cardsList) {
        const cnt = c.count ?? 1
        byRarity[c.rarity] = (byRarity[c.rarity] ?? 0) + cnt
        totalCards += cnt
      }
      setStats({ totalCards, uniqueCards: cardsList.length, byRarity })
    }

    if (streakRes) {
      setDaily({
        last_claim_at: streakRes.lastClaimAt ?? null,
        current_streak: streakRes.currentStreak ?? 0,
        best_streak: streakRes.bestStreak ?? 0,
      })
    }

    const achList = Array.isArray(achRes) ? achRes : (achRes?.achievements ?? [])
    setAchievements(achList.map((a: { achievementId?: string; achievement_id?: string }) => a.achievementId ?? a.achievement_id ?? ''))

    // Charger missions depuis localStorage
    if (user) {
      // Auto-complete daily_login
      trackMissionProgress(user.id, 'daily_login', 1)

      const claimed = getClaimedMissions(user.id)
      const missionList = todayMissions.map(m => {
        const prog = getMissionProgress(user.id, m.id)
        return {
          mission_id: m.id,
          progress: Math.min(prog, m.goal),
          completed: prog >= m.goal,
          xp_claimed: claimed.includes(m.id),
        }
      })
      setMissions(missionList)
    }
  }, [user]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  // Recharger le progress localStorage quand on passe sur l'onglet missions
  useEffect(() => {
    if (activeTab !== 'missions' || !user) return
    const claimed = getClaimedMissions(user.id)
    const missionList = todayMissions.map(m => {
      const prog = getMissionProgress(user.id, m.id)
      return {
        mission_id: m.id,
        progress: Math.min(prog, m.goal),
        completed: prog >= m.goal,
        xp_claimed: claimed.includes(m.id),
      }
    })
    setMissions(missionList)
  }, [activeTab]) // eslint-disable-line

  async function claimDaily() {
    if (claiming) return
    setClaiming(true)
    try {
      const res = await fetch('/api/profile/daily', { method: 'POST' })
      if (!res.ok) throw new Error()
      setClaimMsg('✅ Booster crédité !')
      load()
    } catch { setClaimMsg('Déjà réclamé aujourd\'hui.') }
    finally { setClaiming(false); setTimeout(() => setClaimMsg(''), 3000) }
  }

  async function claimMission(missionId: string) {
    if (!user) return
    setClaimingMission(missionId)
    try {
      const res = await fetch('/api/profile/mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId }),
      })
      const data = await res.json()
      if (res.ok) {
        markMissionClaimed(user.id, missionId)
        if (data?.xp_gained && profile) {
          setProfile({ ...profile, xp: (profile.xp ?? 0) + data.xp_gained })
        }
        const mission = todayMissions.find(m => m.id === missionId)
        addToast({
          type: 'mission',
          title: `Mission complétée !`,
          body: mission ? `${mission.label} — +${mission.xp} XP` : `+${data?.xp_gained ?? 0} XP`,
        })
        load()
      }
    } catch(e) { console.error(e) }
    finally { setClaimingMission(null) }
  }

  const lastClaimMs = daily?.last_claim_at ? new Date(daily.last_claim_at).getTime() : 0
  const canClaim = now - lastClaimMs > 20 * 3600 * 1000
  const msUntilClaim = Math.max(0, lastClaimMs + 20 * 3600 * 1000 - now)
  const hUntil = Math.floor(msUntilClaim / 3600000)
  const mUntil = Math.floor((msUntilClaim % 3600000) / 60000)
  const nextClaimLabel = hUntil > 0 ? `${hUntil}h${mUntil.toString().padStart(2,'0')}` : `${mUntil}min`

  const level = profile?.level ?? 1
  const xp    = profile?.xp ?? 0
  const { current: xpCurrent, needed: xpNeeded, progress } = getLevelProgress(xp, level)
  const unlockedCount = achievements.length
  const completedMissions = missions.filter(m =>
    (m.completed || m.xp_claimed) && todayMissions.some(t => t.id === m.mission_id)
  ).length

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
          { id: 'missions',     label: `🎯 Missions ${completedMissions > 0 ? `· ${completedMissions}/${todayMissions.length}` : ''}` },
          { id: 'achievements', label: `🏆 Succès (${unlockedCount})` },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'missions') load() }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-[#7b2bff] text-white' : 'text-white/40 hover:text-white/60'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          {/* Daily reward */}
          <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(255,154,61,0.07) 0%, rgba(123,43,255,0.05) 100%)' }}>

            {/* Streak header */}
            <div className="px-4 pt-4 pb-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
                style={{ background: 'rgba(255,154,61,0.15)', border: '1px solid rgba(255,154,61,0.25)' }}>
                🔥
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-white font-black text-2xl leading-none">{daily?.current_streak ?? 0}</span>
                  <span className="text-[#ff9a3d] font-bold text-sm">jour{(daily?.current_streak ?? 0) > 1 ? 's' : ''} d&apos;affilée</span>
                </div>
                <p className="text-white/30 text-xs mt-0.5">
                  {daily?.best_streak ? `Record : ${daily.best_streak}j` : 'Reviens chaque jour !'}
                </p>
              </div>
              {!canClaim && (
                <div className="text-right flex-shrink-0">
                  <p className="text-white/30 text-[10px] uppercase tracking-wide">Prochain dans</p>
                  <p className="text-[#ff9a3d] text-sm font-black">{nextClaimLabel}</p>
                </div>
              )}
            </div>

            {/* Barre 7 jours */}
            <div className="px-4 pb-3 flex gap-1.5">
              {Array.from({ length: 7 }, (_, i) => {
                const streak = daily?.current_streak ?? 0
                const filled = i < (streak % 7 === 0 && streak > 0 ? 7 : streak % 7)
                const isToday = i === (streak % 7 === 0 && streak > 0 ? 6 : (streak % 7) - 1) && streak > 0
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full h-1.5 rounded-full transition-all duration-300"
                      style={{
                        background: filled ? '#ff9a3d' : 'rgba(255,255,255,0.07)',
                        boxShadow: isToday ? '0 0 6px rgba(255,154,61,0.6)' : 'none',
                      }} />
                    <span className="text-[9px] font-bold"
                      style={{ color: filled ? 'rgba(255,154,61,0.7)' : 'rgba(255,255,255,0.15)' }}>
                      {['L','M','M','J','V','S','D'][i]}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Claim button */}
            <div className="px-4 pb-4">
              <button onClick={claimDaily} disabled={!canClaim || claiming}
                className="w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2"
                style={canClaim
                  ? { background: 'linear-gradient(135deg,#ff9a3d,#e07820)', color: 'white', boxShadow: '0 0 24px rgba(255,154,61,0.35)' }
                  : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', cursor: 'default' }}>
                {claiming ? '…' : canClaim ? '🎴 Réclamer mon booster quotidien' : '✓ Déjà réclamé aujourd\'hui'}
              </button>
              {claimMsg && <p className="text-xs text-[#4a9e6a] text-center mt-2 font-bold">{claimMsg}</p>}
            </div>
          </div>

          {/* Missions aperçu */}
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/60 text-xs font-bold uppercase tracking-wider">Missions du jour</p>
              <button onClick={() => setActiveTab('missions')}
                className="text-[#a78bfa] text-xs font-bold hover:text-white transition-colors">
                Voir tout →
              </button>
            </div>
            <div className="space-y-2">
              {todayMissions.map(mission => {
                const prog = missions.find(m => m.mission_id === mission.id)
                const current = Math.min(prog?.progress ?? 0, mission.goal)
                const completed = prog?.completed ?? false
                const claimed = prog?.xp_claimed ?? false
                const pct = Math.min(100, (current / mission.goal) * 100)
                return (
                  <div key={mission.id} className="flex items-center gap-3">
                    <span className="text-base flex-shrink-0">{mission.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-white text-xs font-bold truncate">{mission.label}</span>
                        <span className="text-[10px] flex-shrink-0 font-bold"
                          style={{ color: claimed ? '#4a9e6a' : completed ? '#ff9a3d' : 'rgba(167,139,250,0.7)' }}>
                          {claimed ? '✓' : `+${mission.xp} XP`}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-white/[0.07] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: claimed ? '#4a9e6a' : completed ? '#ff9a3d' : 'linear-gradient(90deg,#7b2bff,#a855f7)' }} />
                      </div>
                    </div>
                    <span className="text-[10px] text-white/30 flex-shrink-0 w-8 text-right">{current}/{mission.goal}</span>
                  </div>
                )
              })}
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
          {/* Header missions */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-black text-sm">Missions du jour</p>
              <p className="text-white/30 text-xs mt-0.5">
                Reset à minuit · {completedMissions}/{todayMissions.length} complétées
              </p>
            </div>
            <button onClick={load}
              className="px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/40 text-xs font-bold hover:text-white/70 hover:bg-white/[0.08] transition-colors">
              ↻ Actualiser
            </button>
          </div>

          {/* XP total disponible */}
          {completedMissions < todayMissions.length && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#7b2bff]/[0.08] border border-[#7b2bff]/20">
              <span className="text-[#a78bfa] text-xs">⚡</span>
              <p className="text-[#a78bfa] text-xs">
                <span className="font-black">
                  +{todayMissions.filter((m, i) => !(missions.find(p => p.mission_id === m.id)?.xp_claimed)).reduce((s, m) => s + m.xp, 0)} XP
                </span>
                {' '}disponibles aujourd&apos;hui
              </p>
            </div>
          )}

          {todayMissions.map(mission => {
            const prog = missions.find(m => m.mission_id === mission.id)
            const current = Math.min(prog?.progress ?? 0, mission.goal)
            const completed = (prog?.progress ?? 0) >= mission.goal
            const claimed = prog?.xp_claimed ?? false
            const pct = Math.min(100, (current / mission.goal) * 100)

            return (
              <div key={mission.id}
                className="rounded-2xl border overflow-hidden transition-all"
                style={{
                  background: claimed
                    ? 'rgba(0,200,150,0.04)'
                    : completed
                    ? 'rgba(255,154,61,0.06)'
                    : 'rgba(255,255,255,0.03)',
                  borderColor: claimed
                    ? 'rgba(0,200,150,0.2)'
                    : completed
                    ? 'rgba(255,154,61,0.25)'
                    : 'rgba(255,255,255,0.07)',
                }}>

                <div className="p-4 flex items-center gap-4">
                  {/* Icône + état */}
                  <div className="relative flex-shrink-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                      style={{
                        background: claimed
                          ? 'rgba(0,200,150,0.15)'
                          : completed
                          ? 'rgba(255,154,61,0.15)'
                          : 'rgba(255,255,255,0.06)',
                      }}>
                      {claimed ? '✅' : mission.icon}
                    </div>
                    {completed && !claimed && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff9a3d] flex items-center justify-center animate-pulse">
                        <span className="text-[8px] text-white font-black">!</span>
                      </div>
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-white font-black text-sm">{mission.label}</p>
                      <span className="text-xs font-black flex-shrink-0"
                        style={{ color: claimed ? '#4a9e6a' : completed ? '#ff9a3d' : '#a78bfa' }}>
                        {claimed ? '✓ Réclamé' : `+${mission.xp} XP`}
                      </span>
                    </div>
                    <p className="text-white/40 text-xs mb-2">{mission.desc}</p>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: claimed
                              ? '#4a9e6a'
                              : completed
                              ? 'linear-gradient(90deg,#ff9a3d,#ffb347)'
                              : 'linear-gradient(90deg,#7b2bff,#a855f7)',
                          }} />
                      </div>
                      <span className="text-[11px] font-bold flex-shrink-0"
                        style={{ color: completed ? (claimed ? '#4a9e6a' : '#ff9a3d') : 'rgba(255,255,255,0.3)' }}>
                        {current}/{mission.goal}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bouton claim */}
                {completed && !claimed && (
                  <div className="px-4 pb-4">
                    <button onClick={() => claimMission(mission.id)}
                      disabled={claimingMission === mission.id}
                      className="w-full py-2.5 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg,#ff9a3d,#e07820)', boxShadow: '0 0 16px rgba(255,154,61,0.3)' }}>
                      {claimingMission === mission.id ? '…' : `🎁 Réclamer +${mission.xp} XP`}
                    </button>
                  </div>
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
                      ? <span className="text-[#4a9e6a] text-xs font-bold">✓</span>
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
