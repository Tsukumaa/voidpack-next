'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// Types
interface Player {
  user_id: string
  username: string | null
  avatar_url: string | null
  level: number
  xp: number
  packs_opened: number
  current_streak: number
  void_pulls: number
  highest_rarity: string | null
}

// Types de boosters chargés depuis Supabase
interface BoosterType { value: string; label: string }

export default function AdminPage() {
  const [players, setPlayers]         = useState<Player[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [message, setMessage]         = useState('')
  const [msgType, setMsgType]         = useState<'success' | 'error' | ''>('')
  const [creditModal, setCreditModal] = useState<{ player: Player } | null>(null)
  const [creditType, setCreditType]   = useState('void')
  const [creditQty, setCreditQty]     = useState(1)
  const [crediting, setCrediting]     = useState(false)
  const [boosterTypes, setBoosterTypes] = useState<BoosterType[]>([
    { value: 'void', label: 'VOID Pack (global)' }
  ])

  const supabase = createClient()

  const loadPlayers = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('player_profiles')
      .select('user_id, username, avatar_url, level, xp, packs_opened, current_streak, void_pulls, highest_rarity')
      .order('xp', { ascending: false })
      .limit(100)
    setPlayers(data ?? [])
    setLoading(false)
  }, []) // eslint-disable-line

  useEffect(() => {
    loadPlayers()
    loadBoosterTypes()
  }, [loadPlayers]) // eslint-disable-line

  async function loadBoosterTypes() {
    const { data } = await supabase
      .from('families')
      .select('key, label')
      .order('label')
    if (data && data.length > 0) {
      setBoosterTypes([
        { value: 'void', label: 'VOID Pack (global)' },
        ...data.map((f: { key: string; label: string }) => ({
          value: f.key,
          label: `${f.label} Pack`,
        })),
      ])
    }
  }

  const showMsg = (msg: string, type: 'success' | 'error') => {
    setMessage(msg)
    setMsgType(type)
    setTimeout(() => { setMessage(''); setMsgType('') }, 4000)
  }

  const handleCredit = async () => {
    if (!creditModal) return
    setCrediting(true)
    try {
      for (let i = 0; i < creditQty; i++) {
        const { error } = await supabase.rpc('credit_booster_to_user', {
          p_user_id:      creditModal.player.user_id,
          p_booster_type: creditType,
          p_source:       'admin',
        })
        if (error) throw error
      }
      showMsg(`✅ ${creditQty}x "${creditType}" crédité(s) à ${creditModal.player.username}`, 'success')
      setCreditModal(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showMsg(`❌ ${msg}`, 'error')
    } finally {
      setCrediting(false)
    }
  }

  const filtered = players.filter(p =>
    !search || (p.username ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">⬡ Admin VOID Pack</h1>
          <p className="text-white/50 text-sm mt-1">{players.length} joueurs</p>
        </div>
        <a href="/pack" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors">
          ← Retour au jeu
        </a>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${msgType === 'success' ? 'bg-[rgba(0,120,80,.2)] border border-[rgba(0,200,150,.3)] text-[#00c896]' : 'bg-[rgba(120,20,20,.2)] border border-[rgba(255,80,80,.3)] text-[#ff8080]'}`}>
          {message}
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un joueur…"
          className="w-full max-w-sm px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-[#7b2bff]/60 focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/8 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 bg-white/3">
              <th className="text-left px-4 py-3 text-white/50 font-semibold uppercase text-xs tracking-wider">Joueur</th>
              <th className="text-left px-4 py-3 text-white/50 font-semibold uppercase text-xs tracking-wider">Niveau</th>
              <th className="text-left px-4 py-3 text-white/50 font-semibold uppercase text-xs tracking-wider">XP</th>
              <th className="text-left px-4 py-3 text-white/50 font-semibold uppercase text-xs tracking-wider">Packs</th>
              <th className="text-left px-4 py-3 text-white/50 font-semibold uppercase text-xs tracking-wider">Streak</th>
              <th className="text-right px-4 py-3 text-white/50 font-semibold uppercase text-xs tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-white/40">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-white/40">Aucun joueur.</td></tr>
            ) : filtered.map((p, i) => (
              <tr key={p.user_id} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7b2bff] to-[#00c896] flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={p.avatar_url ? { backgroundImage: `url(${p.avatar_url})`, backgroundSize: 'cover' } : {}}>
                      {!p.avatar_url && (p.username?.[0]?.toUpperCase() ?? '?')}
                    </div>
                    <span className="font-medium">{p.username ?? '—'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#a78bfa]">{p.level}</td>
                <td className="px-4 py-3 text-white/70">{(p.xp ?? 0).toLocaleString('fr-FR')}</td>
                <td className="px-4 py-3 text-white/70">{p.packs_opened ?? 0}</td>
                <td className="px-4 py-3 text-white/70">{p.current_streak ?? 0}j</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setCreditModal({ player: p })}
                    className="px-3 py-1.5 rounded-lg bg-[#7b2bff]/20 border border-[#7b2bff]/40 text-[#a78bfa] text-xs font-bold hover:bg-[#7b2bff]/35 transition-colors"
                  >
                    🎴 Créditer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modale crédit */}
      {creditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setCreditModal(null) }}
        >
          <div className="w-[min(420px,90vw)] bg-[rgba(8,6,18,.97)] border border-[#7b2bff]/30 rounded-2xl p-7 shadow-2xl">
            <h2 className="text-base font-bold mb-1">🎴 Créditer des boosters</h2>
            <p className="text-sm text-white/50 mb-5">
              Joueur : <span className="text-white/80">{creditModal.player.username}</span>
            </p>

            {/* Type */}
            <label className="block mb-4">
              <span className="block text-xs uppercase tracking-widest text-white/50 font-bold mb-2">Type de booster</span>
              <select
                value={creditType}
                onChange={e => setCreditType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/6 border border-[#7b2bff]/30 text-sm focus:outline-none focus:border-[#7b2bff]/60"
              >
                {boosterTypes.map(t => (
                  <option key={t.value} value={t.value} className="bg-[#0a0318]">{t.label}</option>
                ))}
              </select>
            </label>

            {/* Quantité */}
            <label className="block mb-6">
              <span className="block text-xs uppercase tracking-widest text-white/50 font-bold mb-2">Quantité</span>
              <input
                type="number"
                min={1} max={50}
                value={creditQty}
                onChange={e => setCreditQty(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                className="w-full px-3 py-2.5 rounded-xl bg-white/6 border border-[#7b2bff]/30 text-sm focus:outline-none focus:border-[#7b2bff]/60"
              />
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setCreditModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/15 text-white/60 text-sm font-bold hover:bg-white/5 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCredit}
                disabled={crediting}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#7b2bff] to-[#4a1fa8] text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {crediting ? '…' : 'Créditer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
