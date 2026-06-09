'use client'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useGameStore } from '@/store/game'

const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#b86dff',
  rare: '#4aa3ff', uncommon: '#22c55e', common: '#9ca3af',
}

const XP_PER_LEVEL = (level: number) => Math.floor(1000 * Math.pow(1.18, level - 1))

function getLevelProgress(xp: number, level: number) {
  const current = Array.from({ length: level - 1 }, (_, i) => XP_PER_LEVEL(i + 1)).reduce((a, b) => a + b, 0)
  const needed  = XP_PER_LEVEL(level)
  const progress = Math.min(1, (xp - current) / needed)
  return { current: xp - current, needed, progress: Math.max(0, progress) }
}

interface Stats {
  totalCards: number
  uniqueCards: number
  byRarity: Record<string, number>
  byFamily: Record<string, number>
}

interface DailyReward {
  last_claim_at: string | null
  current_streak: number
  best_streak: number
}

const ACHIEVEMENTS = [
  { id: 'first_pack',    label: 'Premier booster',   desc: 'Ouvrir ton premier booster',         icon: '🎴' },
  { id: 'rare_pull',     label: 'Chasseur de raretés', desc: 'Obtenir une carte rare ou plus',    icon: '💎' },
  { id: 'epic_pull',     label: 'Épique',             desc: 'Obtenir une carte épique',           icon: '⚡' },
  { id: 'legendary',     label: 'Légendaire',         desc: 'Obtenir une carte légendaire',       icon: '👑' },
  { id: 'void_pull',     label: 'VOID',               desc: 'Obtenir une carte VOID',             icon: '🌀' },
  { id: 'streak_3',      label: 'Régulier',           desc: '3 jours consécutifs',               icon: '🔥' },
  { id: 'streak_7',      label: 'Assidu',             desc: '7 jours consécutifs',               icon: '💪' },
  { id: 'collector_10',  label: 'Collectionneur',     desc: '10 cartes uniques',                 icon: '📚' },
  { id: 'collector_50',  label: 'Archiviste',         desc: '50 cartes uniques',                 icon: '🗃️' },
]

export default function ProfilPage() {
  const { user, profile } = useGameStore(s => ({ user: s.user, profile: s.profile }))
  const [stats, setStats]           = useState<Stats | null>(null)
  const [daily, setDaily]           = useState<DailyReward | null>(null)
  const [achievements, setAchievements] = useState<string[]>([])
  const [claiming, setClaiming]     = useState(false)
  const [claimMsg, setClaimMsg]     = useState('')
  const [loading, setLoading]       = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const sb = createClient()

    // Stats collection
    const { data: cards } = await sb
      .from('player_cards')
      .select('card_id, rarity, family')
      .eq('user_id', user.id)

    if (cards) {
      const byRarity: Record<string, number> = {}
      const byFamily: Record<string, number> = {}
      const unique = new Set<string>()
      for (const c of cards) {
        byRarity[c.rarity] = (byRarity[c.rarity] ?? 0) + 1
        byFamily[c.family] = (byFamily[c.family] ?? 0) + 1
        unique.add(c.card_id)
      }
      setStats({ totalCards: cards.length, uniqueCards: unique.size, byRarity, byFamily })
    }

    // Daily rewards
    const { data: dr } = await sb
      .from('player_daily_rewards')
      .select('last_claim_at, current_streak, best_streak')
      .eq('user_id', user.id)
      .single()
    setDaily(dr)

    // Achievements
    const { data: ach } = await sb
      .from('player_achievements')
      .select('achievement_id')
      .eq('user_id', user.id)
    setAchievements((ach ?? []).map(a => a.achievement_id))

    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // Claim daily
  async function claimDaily() {
    if (claiming || !canClaim) return
    setClaiming(true)
    try {
      const sb = createClient()
      const { error } = await sb.rpc('claim_daily_reward')
      if (error) throw error
      setClaimMsg('✅ Récompense réclamée !')
      load()
    } catch {
      setClaimMsg('Déjà réclamé aujourd\'hui.')
    } finally {
      setClaiming(false)
      setTimeout(() => setClaimMsg(''), 3000)
    }
  }

  const canClaim = daily?.last_claim_at
    ? new Date().getTime() - new Date(daily.last_claim_at).getTime() > 20 * 3600 * 1000
    : true

  const level = profile?.level ?? 1
  const xp    = profile?.xp ?? 0
  const { current: xpCurrent, needed: xpNeeded, progress } = getLevelProgress(xp, level)

  if (!user) return (
    <div className="flex items-center justify-center min-h-[50vh] text-white/30 text-sm">
      Connecte-toi pour voir ton profil.
    </div>
  )

  return (
    <div className="pb-4 space-y-4">

      {/* Header profil */}
      <div className="flex items-center gap-4 pt-2">
        <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 border border-white/10"
          style={profile?.avatar_url ? { backgroundImage: `url(${profile.avatar_url})`, backgroundSize: 'cover' } : { background: 'linear-gradient(135deg, #7b2bff, #4a1fa8)' }}>
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
            style={{ background: RARITY_COLOR[profile.highest_rarity] + '20', color: RARITY_COLOR[profile.highest_rarity] }}>
            {profile.highest_rarity}
          </div>
        )}
      </div>

      {/* XP + progression */}
      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-white/60 text-xs font-bold uppercase tracking-wider">Expérience</span>
          <span className="text-white/50 text-xs">{xpCurrent.toLocaleString('fr-FR')} / {xpNeeded.toLocaleString('fr-FR')} XP</span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progress * 100}%`, background: 'linear-gradient(90deg, #7b2bff, #a855f7)' }} />
        </div>
        <p className="text-white/30 text-xs">{xp.toLocaleString('fr-FR')} XP total</p>
      </div>

      {/* Daily reward */}
      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white font-bold text-sm">Récompense quotidienne</p>
            <p className="text-white/40 text-xs mt-0.5">
              🔥 Streak actuel : <span className="text-[#ff9a3d] font-bold">{daily?.current_streak ?? 0}j</span>
              {daily?.best_streak ? <span className="ml-2 text-white/30">· Record : {daily.best_streak}j</span> : null}
            </p>
          </div>
          <button
            onClick={claimDaily}
            disabled={!canClaim || claiming}
            className="px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={canClaim ? { background: 'linear-gradient(135deg, #7b2bff, #4a1fa8)', color: 'white' } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}
          >
            {claiming ? '…' : canClaim ? 'Réclamer' : '✓ Fait'}
          </button>
        </div>
        {claimMsg && <p className="text-xs text-[#00c896]">{claimMsg}</p>}

        {/* Streak calendar (7 derniers jours) */}
        <div className="flex gap-1.5 mt-2">
          {Array.from({ length: 7 }, (_, i) => {
            const filled = daily ? i < daily.current_streak : false
            return (
              <div key={i} className="flex-1 h-1.5 rounded-full transition-all"
                style={{ background: filled ? '#ff9a3d' : 'rgba(255,255,255,0.08)' }} />
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
          {/* Par rareté */}
          <div className="space-y-1.5">
            {['void','legendary','epic','rare','uncommon','common'].filter(r => stats.byRarity[r]).map(r => (
              <div key={r} className="flex items-center gap-2">
                <span className="w-16 text-xs capitalize" style={{ color: RARITY_COLOR[r] }}>{r}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{ width: `${(stats.byRarity[r] / stats.totalCards) * 100}%`, background: RARITY_COLOR[r] }} />
                </div>
                <span className="text-white/40 text-xs w-6 text-right">{stats.byRarity[r]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Succès */}
      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4">
        <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3">
          Succès · {achievements.length}/{ACHIEVEMENTS.length}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {ACHIEVEMENTS.map(a => {
            const unlocked = achievements.includes(a.id)
            return (
              <div key={a.id} title={a.desc}
                className="rounded-xl p-2.5 flex flex-col items-center gap-1 transition-all"
                style={{ background: unlocked ? 'rgba(123,43,255,0.15)' : 'rgba(255,255,255,0.03)',
                  border: unlocked ? '1px solid rgba(123,43,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  opacity: unlocked ? 1 : 0.4,
                }}>
                <span className="text-xl">{a.icon}</span>
                <span className="text-[10px] font-bold text-center text-white/70 leading-tight">{a.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
