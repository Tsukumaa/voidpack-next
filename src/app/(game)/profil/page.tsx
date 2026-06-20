'use client'
import React from 'react'
import { Target, Tv2, Flame, Gift, CheckCircle2, Check, PackagePlus, Package, Sparkles, Gem, Zap, Crown, Wind, BookOpen, Map, Archive, Landmark, Trophy, Star, TrendingUp, Award, LogIn, LayoutGrid, Inbox } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { useGameStore } from '@/store/game'
import { FavoriteShowcase } from '@/components/game/FavoriteShowcase'
import { RoleBadge } from '@/components/game/RoleBadge'
import { StatePanel } from '@/components/game/StatePanel'
import { ACHIEVEMENTS, getTodayMissions } from '@/lib/game/achievements'
import { getMissionProgress, getClaimedMissions, markMissionClaimed, trackMissionProgress } from '@/lib/game/mission-tracker'
import { useSocialStore } from '@/store/social'
import { Link as LinkIcon } from 'lucide-react'

const ACHIEVEMENT_ICON: Record<string, React.ReactNode> = {
  open_first:    <Inbox size={18} />,
  open_10:       <Package size={18} />,
  open_50:       <LayoutGrid size={18} />,
  open_100:      <Sparkles size={18} />,
  get_rare:      <Gem size={18} />,
  get_epic:      <Zap size={18} />,
  get_legendary: <Crown size={18} />,
  get_void:      <Wind size={18} />,
  cards_10:      <BookOpen size={18} />,
  cards_25:      <Map size={18} />,
  cards_50:      <Archive size={18} />,
  cards_100:     <Landmark size={18} />,
  streak_3:      <Flame size={18} />,
  streak_7:      <TrendingUp size={18} />,
  streak_30:     <Trophy size={18} />,
  level_5:       <Star size={18} />,
  level_10:      <Award size={18} />,
  level_25:      <Crown size={18} />,
  level_50:      <Sparkles size={18} />,
  // missions
  open_1_pack:    <Inbox size={16} />,
  open_3_packs:   <Package size={16} />,
  get_rare_m:     <Gem size={16} />,
  get_epic_m:     <Zap size={16} />,
  daily_login:    <LogIn size={16} />,
  collect_5:      <BookOpen size={16} />,
  open_void_pack: <Wind size={16} />,
}

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
  const [ownedIds, setOwnedIds]         = useState<string[]>([])
  const [now, setNow]                   = useState(() => Date.now())

  const todayMissions = getTodayMissions()

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const loadMissionsFromStorage = useCallback(() => {
    if (!user) return
    trackMissionProgress(user.id, 'daily_login', 1)
    const claimed = getClaimedMissions(user.id)
    setMissions(todayMissions.map(m => {
      const prog = getMissionProgress(user.id, m.id)
      return {
        mission_id: m.id,
        progress: Math.min(prog, m.goal),
        completed: prog >= m.goal,
        xp_claimed: claimed.includes(m.id),
      }
    }))
  }, [user]) // eslint-disable-line

  const load = useCallback(async () => {
    if (!user) return

    const [cards, dailyData, achData] = await Promise.all([
      fetch('/api/collection').then(r => r.ok ? r.json() : []),
      fetch('/api/profile/streak').then(r => r.ok ? r.json() : null),
      fetch('/api/achievements').then(r => r.ok ? r.json() : []),
    ])

    if (cards?.length >= 0) {
      const byRarity: Record<string, number> = {}
      let totalCards = 0
      for (const c of cards) {
        const rarity = c.rarity ?? 'common'
        const cnt = c.count ?? 1
        byRarity[rarity] = (byRarity[rarity] ?? 0) + cnt
        totalCards += cnt
      }
      setStats({ totalCards, uniqueCards: cards.length, byRarity })
    }
    setOwnedIds((cards ?? []).map((c: { card_id?: string; cardId?: string }) => c.card_id ?? c.cardId ?? '').filter(Boolean))

    if (dailyData) setDaily({
      last_claim_at: dailyData.lastClaimAt ?? null,
      current_streak: dailyData.currentStreak ?? 0,
      best_streak: dailyData.bestStreak ?? 0,
    })

    setAchievements((achData ?? []).map((a: { achievementId?: string; achievement_id?: string }) => a.achievementId ?? a.achievement_id ?? ''))

    loadMissionsFromStorage()
  }, [user, loadMissionsFromStorage])

  useEffect(() => { load() }, [load])

  // Refresh missions depuis localStorage quand on bascule sur l'onglet
  useEffect(() => {
    if (activeTab === 'missions') loadMissionsFromStorage()
  }, [activeTab, loadMissionsFromStorage])

  function linkTwitch() {
    const TWITCH_CLIENT_ID = 'cqxwy2c8tbocyx5lsbzi2iblgyow5j'
    const redirectUri = `${window.location.origin}/twitch-callback.html`
    const state = Math.random().toString(36).slice(2)
    sessionStorage.setItem('twitch_oauth_state', state)
    const url = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=user:read:email&state=${state}`
    window.location.href = url
  }

  async function unlinkTwitch() {
    await fetch('/api/twitch/unlink', { method: 'POST' })
    if (profile) setProfile({ ...profile, twitch_login: null })
  }

  async function claimDaily() {
    if (claiming) return
    setClaiming(true)
    try {
      const res = await fetch('/api/profile/daily', { method: 'POST' })
      if (!res.ok) throw new Error('already_claimed')
      setClaimMsg('Booster crédité !')
      load()
    } catch { setClaimMsg('Déjà réclamé aujourd\'hui.') }
    finally { setClaiming(false); setTimeout(() => setClaimMsg(''), 3000) }
  }

  async function claimMission(missionId: string) {
    if (!user) return
    setClaimingMission(missionId)
    try {
      const res = await fetch('/api/profile/mission', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId }),
      })
      if (res.ok) {
        const data = await res.json()
        markMissionClaimed(user.id, missionId)
        if (data?.xp_gained && profile) setProfile({ ...profile, xp: (profile.xp ?? 0) + data.xp_gained })
        const mission = todayMissions.find(m => m.id === missionId)
        addToast({ type: 'mission', title: 'Mission complétée !', body: mission ? `${mission.label} — +${mission.xp} XP` : `+${data?.xp_gained ?? 0} XP` })
        loadMissionsFromStorage()
      }
    } catch(e) { console.error(e) }
    finally { setClaimingMission(null) }
  }

  async function saveFavorites(ids: string[]) {
    if (profile) setProfile({ ...profile, favorite_cards: ids })
    await fetch('/api/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favoriteCards: ids }),
    }).catch(() => {})
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
  const completedMissions = missions.filter(m => m.completed || m.xp_claimed).length

  if (!user) return (
    <StatePanel icon={LinkIcon} title="Pas connecté">
      Connecte-toi pour voir et personnaliser ton profil.
    </StatePanel>
  )

  if (!profile) return null

  return (
    <div className="pb-4 space-y-4 max-w-4xl mx-auto w-full">

      {/* Header sticky */}
      <div className="sticky top-20 z-20 rounded-2xl border border-white/[0.07] px-4 py-3 backdrop-blur-md"
        style={{ backgroundColor: 'rgba(8,10,18,0.88)' }}>

        <div className="flex items-center gap-3 mb-3">
          <div className="relative rounded-full p-[3px] flex-shrink-0"
            style={{ background: `conic-gradient(from -90deg, #7b2bff, #a855f7 ${progress}%, rgba(255,255,255,0.08) ${progress}%)` }}>
            <div className="w-12 h-12 rounded-full overflow-hidden bg-[#0a0612] flex items-center justify-center"
              style={profile?.avatar_url ? { backgroundImage:`url(${profile.avatar_url})`, backgroundSize:'cover' } : {}}>
              {!profile?.avatar_url && (
                <span className="text-lg font-black text-white">{profile?.username?.[0]?.toUpperCase() ?? '?'}</span>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-black text-white text-base truncate">{profile?.username ?? 'Joueur'}</p>
              <RoleBadge role={profile?.role} />
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-[#a78bfa] text-xs font-bold">Niveau {level}</p>
              <p className="text-white/30 text-[10px]">{xpCurrent.toLocaleString('fr-FR')} / {xpNeeded.toLocaleString('fr-FR')} XP</p>
            </div>
          </div>

          {profile?.highest_rarity && (
            <div className="px-2.5 py-1 rounded-lg text-xs font-bold capitalize flex-shrink-0"
              style={{ background: RARITY_COLOR[profile.highest_rarity]+'20', color: RARITY_COLOR[profile.highest_rarity], border: `1px solid ${RARITY_COLOR[profile.highest_rarity]}33` }}>
              {profile.highest_rarity}
            </div>
          )}
        </div>

        <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width:`${progress}%`, background:'linear-gradient(90deg,#7b2bff,#a855f7)' }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        {([
          { id: 'overview',     label: 'Vue d\'ensemble' },
          { id: 'missions',     label: completedMissions > 0 ? `Missions · ${completedMissions}/${todayMissions.length}` : 'Missions' },
          { id: 'achievements', label: `Succès (${unlockedCount})` },
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
          <FavoriteShowcase
            favoriteIds={profile.favorite_cards ?? []}
            editable
            ownedIds={ownedIds}
            onSave={saveFavorites}
          />

          {/* Twitch */}
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(145,71,255,0.15)' }}>
                  <Tv2 size={16} className="text-white/60" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Compte Twitch</p>
                  {profile?.twitch_login
                    ? <p className="text-[#00c896] text-xs mt-0.5">Lié à {profile.twitch_login}</p>
                    : <p className="text-white/40 text-xs mt-0.5">Lie ton compte pour recevoir des boosters</p>
                  }
                </div>
              </div>
              {profile?.twitch_login ? (
                <button onClick={unlinkTwitch}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/50 text-xs font-bold transition-colors">
                  Délier
                </button>
              ) : (
                <button onClick={linkTwitch}
                  className="px-3 py-1.5 rounded-xl text-white text-xs font-bold"
                  style={{ background: 'linear-gradient(135deg,#9147ff,#5a1fb8)' }}>
                  Lier
                </button>
              )}
            </div>
          </div>

          {/* Daily reward — redesign */}
          <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(255,154,61,0.07) 0%, rgba(123,43,255,0.05) 100%)' }}>

            <div className="px-4 pt-4 pb-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,154,61,0.15)', border: '1px solid rgba(255,154,61,0.25)' }}>
                <Flame size={22} style={{ color: '#ff9a3d' }} />
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

            {/* 7 jours */}
            <div className="px-4 pb-3 flex gap-1.5">
              {Array.from({ length: 7 }, (_, i) => {
                const streak = daily?.current_streak ?? 0
                const mod = streak % 7
                const filled = i < (mod === 0 && streak > 0 ? 7 : mod)
                const isToday = streak > 0 && i === (mod === 0 ? 6 : mod - 1)
                return (
                  <div key={i} className="flex-1">
                    <div className="w-full h-1.5 rounded-full transition-all duration-300"
                      style={{
                        background: filled ? '#ff9a3d' : 'rgba(255,255,255,0.07)',
                        boxShadow: isToday ? '0 0 6px rgba(255,154,61,0.7)' : 'none',
                      }} />
                  </div>
                )
              })}
            </div>

            <div className="px-4 pb-4">
              <button onClick={claimDaily} disabled={!canClaim || claiming}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                style={canClaim
                  ? { background: 'rgba(255,154,61,0.15)', color: '#ff9a3d', border: '1px solid rgba(255,154,61,0.3)' }
                  : { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'not-allowed' }}>
                {claiming ? '…' : canClaim
                  ? <><PackagePlus size={15} />Réclamer mon booster quotidien</>
                  : <><Check size={14} />Déjà réclamé aujourd&apos;hui</>}
              </button>
              {claimMsg && <p className="text-xs text-[#00c896] text-center mt-2 font-bold">{claimMsg}</p>}
            </div>
          </div>

          {/* Missions aperçu */}
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/60 text-xs font-bold uppercase tracking-wider">Missions du jour</p>
              <button onClick={() => setActiveTab('missions')}
                className="px-2.5 py-1 rounded-lg text-xs font-bold transition-colors"
                style={{ background: 'rgba(123,43,255,0.12)', color: '#a78bfa', border: '1px solid rgba(123,43,255,0.2)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(123,43,255,0.22)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(123,43,255,0.12)' }}>
                Voir tout
              </button>
            </div>
            <div className="space-y-2.5">
              {todayMissions.map(mission => {
                const prog = missions.find(m => m.mission_id === mission.id)
                const current = Math.min(prog?.progress ?? 0, mission.goal)
                const completed = prog?.completed ?? false
                const claimed = prog?.xp_claimed ?? false
                const pct = Math.min(100, (current / mission.goal) * 100)
                return (
                  <div key={mission.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>
                      {ACHIEVEMENT_ICON[mission.id] ?? ACHIEVEMENT_ICON[mission.id + '_m'] ?? <Target size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-white text-xs font-bold truncate">{mission.label}</span>
                        {claimed
                          ? <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0"
                              style={{ background: 'rgba(0,200,150,0.12)', color: '#00c896', border: '1px solid rgba(0,200,150,0.2)' }}>
                              <Check size={9} />Réclamé
                            </span>
                          : <span className="text-[10px] flex-shrink-0 font-black"
                              style={{ color: completed ? '#ff9a3d' : 'rgba(167,139,250,0.7)' }}>
                              +{mission.xp} XP
                            </span>
                        }
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: claimed ? '#00c896' : completed ? '#ff9a3d' : 'linear-gradient(90deg,#7b2bff,#a855f7)' }} />
                      </div>
                    </div>
                    <span className="text-[10px] text-white/30 flex-shrink-0 w-8 text-right font-bold">{current}/{mission.goal}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Stats collection */}
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
              <div className="flex gap-1.5">
                {['void','legendary','epic','rare','common'].filter(r => stats.byRarity[r]).map(r => (
                  <div key={r} className="flex-1 rounded-xl px-2 py-2.5 flex flex-col items-center gap-1"
                    style={{ background: `${RARITY_COLOR[r]}12`, border: `1px solid ${RARITY_COLOR[r]}28` }}>
                    <span className="text-white font-black text-sm leading-none">{stats.byRarity[r]}</span>
                    <span className="text-[10px] font-bold capitalize leading-none" style={{ color: RARITY_COLOR[r] }}>{r}</span>
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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-black text-sm">Missions du jour</p>
              <p className="text-white/30 text-xs mt-0.5">Reset à minuit · {completedMissions}/{todayMissions.length} complétées</p>
            </div>
            <button onClick={loadMissionsFromStorage}
              className="px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/40 text-xs font-bold hover:text-white/70 hover:bg-white/[0.08] transition-colors">
              ↻ Actualiser
            </button>
          </div>

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
                  background: claimed ? 'rgba(0,200,150,0.04)' : completed ? 'rgba(255,154,61,0.06)' : 'rgba(255,255,255,0.03)',
                  borderColor: claimed ? 'rgba(0,200,150,0.2)' : completed ? 'rgba(255,154,61,0.25)' : 'rgba(255,255,255,0.07)',
                }}>

                <div className="p-4 flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{
                        background: claimed ? 'rgba(0,200,150,0.15)' : completed ? 'rgba(255,154,61,0.15)' : 'rgba(255,255,255,0.06)',
                      }}>
                      {claimed
                        ? <CheckCircle2 size={20} style={{ color: '#00c896' }} />
                        : <span style={{ color: completed ? '#ff9a3d' : 'rgba(255,255,255,0.4)', display:'flex' }}>
                            {ACHIEVEMENT_ICON[mission.id] ?? <Target size={18} />}
                          </span>}
                    </div>
                    {completed && !claimed && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff9a3d] flex items-center justify-center animate-pulse">
                        <span className="text-[8px] text-white font-black leading-none">!</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-white font-black text-sm">{mission.label}</p>
                      <span className="flex items-center gap-1 text-xs font-black flex-shrink-0"
                        style={{ color: claimed ? '#00c896' : completed ? '#ff9a3d' : '#a78bfa' }}>
                        {claimed && <Check size={11} />}{claimed ? 'Réclamé' : `+${mission.xp} XP`}
                      </span>
                    </div>
                    <p className="text-white/40 text-xs mb-2">{mission.desc}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: claimed ? '#00c896' : completed ? 'linear-gradient(90deg,#ff9a3d,#ffb347)' : 'linear-gradient(90deg,#7b2bff,#a855f7)',
                          }} />
                      </div>
                      <span className="text-[11px] font-bold flex-shrink-0"
                        style={{ color: completed ? (claimed ? '#00c896' : '#ff9a3d') : 'rgba(255,255,255,0.3)' }}>
                        {current}/{mission.goal}
                      </span>
                    </div>
                  </div>
                </div>

                {completed && !claimed && (
                  <div className="px-4 pb-4">
                    <button onClick={() => claimMission(mission.id)}
                      disabled={claimingMission === mission.id}
                      className="w-full py-2.5 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg,#ff9a3d,#e07820)', boxShadow: '0 0 16px rgba(255,154,61,0.3)' }}>
                      {claimingMission === mission.id ? '…' : <><Gift size={14} />Réclamer +{mission.xp} XP</>}
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
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: unlocked ? 'rgba(123,43,255,0.15)' : 'rgba(255,255,255,0.05)', color: unlocked ? '#a78bfa' : 'rgba(255,255,255,0.3)' }}>
                    {ACHIEVEMENT_ICON[a.id] ?? <Target size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm">{a.label}</p>
                    <p className="text-white/40 text-xs truncate">{a.desc}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {unlocked
                      ? <Check size={14} style={{ color: '#00c896' }} />
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
