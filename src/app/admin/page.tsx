'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Users, Globe, Layers, Package, Shirt, Shield, Settings, Download, Pin, ArrowLeft, Check, Lock, Hexagon, RefreshCw, Pencil, X, Tv2, Palette, Link as LinkIcon, Trash2, Plus } from 'lucide-react'
import { RoleBadge, SubscriberBadge, type UserRole } from '@/components/game/RoleBadge'

// ─── Types ───────────────────────────────────────────────────────────────────
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
  unlocked_card_backs: string[] | null
  owned_arenas:        string[]
  role: UserRole
  is_subscriber?: boolean
}

interface Family {
  key: string
  label: string
  color: string
  description: string
  order_index?: number
  active?: boolean
  _originalKey?: string
}

interface Card {
  id?: string
  name: string
  family: string
  rarity: string
  character?: string
  image_url: string
  description?: string
  metadata?: { combat?: { atk?: number; hp?: number; cost?: number; effects?: string[] } }
  // UI helpers (not stored directly)
  combat_atk: number
  combat_hp: number
  combat_cost: number
  combat_effects: string[]
  artist: string
  artistUrl: string
}

interface Setting {
  key: string
  value: string
}

type Tab = 'players' | 'families' | 'cards' | 'boosters' | 'cardbacks' | 'arenas' | 'twitch' | 'artists' | 'settings'

interface Arena {
  id?: string
  name: string
  image_url?: string
  gradient?: string
  active?: boolean
  order_index?: number
}

interface CardBack {
  id?: string
  name: string
  gradient: string
  pattern: string
  image_url?: string
  order_index?: number
  active?: boolean
}

const RARITIES = ['common',  'rare', 'epic', 'legendary', 'void']

// ─── Helper API admin (service role, bypass RLS) ──────────────────────────────
async function adminDb(action: string, table: string, data?: unknown, eq?: { col: string; val: unknown; onConflict?: string }) {
  const res = await fetch('/api/admin/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, table, data, eq }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.data
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('players')
  const [msg, setMsg] = useState('')
  const [msgOk, setMsgOk] = useState(true)
  function showMsg(text: string, ok = true) {
    setMsg(text); setMsgOk(ok)
    setTimeout(() => setMsg(''), 4000)
  }

  const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: 'players',   icon: <Users size={13} />,    label: 'Joueurs' },
    { id: 'artists',   icon: <Palette size={13} />,  label: 'Artistes' },
    { id: 'families',  icon: <Globe size={13} />,    label: 'Familles' },
    { id: 'cards',     icon: <Layers size={13} />,   label: 'Cartes' },
    { id: 'boosters',  icon: <Package size={13} />,  label: 'Boosters' },
    { id: 'cardbacks', icon: <Shirt size={13} />,    label: 'Dos' },
    { id: 'arenas',    icon: <Shield size={13} />,   label: 'Arènes' },
    { id: 'twitch',    icon: <Tv2 size={13} />,      label: 'Twitch' },
    { id: 'settings',  icon: <Settings size={13} />, label: 'Params' },
  ]

  return (
    <div className="min-h-screen text-[#f6f1ff]" style={{ background: '#06010e' }}>
      {/* Topbar */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 py-3 border-b"
        style={{
          background: 'rgba(6,1,14,0.85)',
          backdropFilter: 'blur(16px)',
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <h1
          className="text-base sm:text-lg font-bold tracking-widest uppercase"
          style={{ fontFamily: 'Cinzel, serif', color: '#c4a8ff' }}
        >
          <Hexagon size={16} className="inline-block mr-1.5" /> Admin Void Pack
        </h1>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          {msg && (
            <span
              className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
                msgOk
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              {msg}
            </span>
          )}
          <button
            onClick={async () => {
              try {
                const [cards, families, cardBacks, settings] = await Promise.all([
                  fetch('/api/admin/db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'select', table: 'custom_cards', data: { order: 'created_at ASC' } }) }).then(r => r.json()),
                  fetch('/api/admin/db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'select', table: 'families', data: { order: 'order_index ASC' } }) }).then(r => r.json()),
                  fetch('/api/admin/db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'select', table: 'card_backs', data: { order: 'order_index ASC' } }) }).then(r => r.json()),
                  fetch('/api/admin/db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'select', table: 'settings' }) }).then(r => r.json()),
                ])
                const seed = { custom_cards: cards.data ?? [], families: families.data ?? [], card_backs: cardBacks.data ?? [], settings: settings.data ?? [] }
                const blob = new Blob([JSON.stringify(seed, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `voidpack-seed-${new Date().toISOString().slice(0,10)}.json`
                a.click()
                URL.revokeObjectURL(url)
                showMsg('Export téléchargé')
              } catch {
                showMsg('Erreur export', false)
              }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: 'rgba(123,43,255,0.15)', border: '1px solid rgba(123,43,255,0.3)', color: '#c084fc' }}
          >
            <Download size={12} className="inline-block mr-1" />Seed
          </button>
          <Link
            href="/admin/board"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}
          >
            <Pin size={12} className="inline-block mr-1" />Board
          </Link>
          <Link
            href="/pack"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
          >
            <ArrowLeft size={12} className="inline-block mr-1" />Jeu
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="pt-4 overflow-x-auto scrollbar-hide px-4 sm:px-6">
        <div
          className="flex p-2 rounded-[26px] gap-1 w-max sm:w-full min-w-full"
          style={{
            background: 'rgba(8,10,18,0.82)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 16px 50px rgba(0,0,0,0.6)',
          }}
        >
          {tabs.map(t => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="relative flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-3 py-2 rounded-[18px] transition-all duration-300 shrink-0 min-w-[52px] sm:min-w-0"
                style={active
                  ? { color: '#b97cff', background: 'rgba(123,43,255,0.10)', boxShadow: 'inset 0 0 20px rgba(185,124,255,0.06)' }
                  : { color: 'rgba(255,255,255,0.30)' }
                }
              >
                <div style={active ? { filter: 'drop-shadow(0 0 6px rgba(185,124,255,0.75))', transform: 'scale(1.1)', transition: 'transform 0.2s ease' } : { transform: 'scale(1)', transition: 'transform 0.2s ease' }}>
                  {t.icon}
                </div>
                <span className="text-[8px] sm:text-[10px] font-bold tracking-wider uppercase whitespace-nowrap sm:hidden" style={{ fontFamily: 'Cinzel, serif' }}>
                  {t.label.slice(0, 3)}
                </span>
                <span className="text-[10px] font-bold tracking-wider uppercase whitespace-nowrap hidden sm:inline" style={{ fontFamily: 'Cinzel, serif' }}>
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4 sm:p-6">
        {tab === 'players'  && <PlayersTab  onMsg={showMsg} />}
        {tab === 'families' && <FamiliesTab onMsg={showMsg} />}
        {tab === 'cards'    && <CardsTab    onMsg={showMsg} />}
        {tab === 'boosters' && <BoostersTab onMsg={showMsg} />}
        {tab === 'cardbacks' && <CardBacksTab onMsg={showMsg} />}
        {tab === 'arenas'   && <ArenasTab onMsg={showMsg} />}
        {tab === 'twitch'   && <TwitchTab onMsg={showMsg} />}
        {tab === 'artists'  && <ArtistsTab onMsg={showMsg} />}
        {tab === 'settings' && <SettingsTab onMsg={showMsg} />}
      </div>
    </div>
  )
}

// ─── Onglet Joueurs (garde sb anon — lecture + rpc seulement) ─────────────────
function PlayersTab({ onMsg }: { onMsg: (msg: string, ok?: boolean) => void }) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [modal, setModal]     = useState<Player | null>(null)
  const [cType, setCType]     = useState('void')
  const [cQty, setCQty]       = useState(1)
  const [crediting, setCrediting] = useState(false)
  const [families, setFamilies] = useState<{ value: string; label: string }[]>([])
  const [backModal, setBackModal] = useState<Player | null>(null)
  const [savingBacks, setSavingBacks] = useState(false)
  const [cardBacks, setCardBacks] = useState<CardBack[]>([])
  const [arenaModal, setArenaModal] = useState<Player | null>(null)
  const [savingArenas, setSavingArenas] = useState(false)
  const [arenas, setArenas] = useState<Arena[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/admin/players').then(r => r.json()).catch(() => [])
    setPlayers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    fetch('/api/families').then(r => r.json()).then((data: Family[]) => {
      setFamilies([
        { value: 'void', label: 'VOID Pack (global)' },
        ...(data ?? []).map((f) => ({ value: f.key, label: `${f.label} Pack` })),
      ])
    }).catch(() => setFamilies([{ value: 'void', label: 'VOID Pack (global)' }]))
    adminDb('select', 'card_backs', { order: 'order_index' }).then((data) => setCardBacks(data ?? [])).catch(() => {})
    adminDb('select', 'arena_backgrounds', { order: 'order_index' }).then((data) => setArenas(data ?? [])).catch(() => {})
  }, [load])

  async function credit() {
    if (!modal) return
    setCrediting(true)
    try {
      const res = await fetch('/api/admin/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'credit_booster', userId: modal.user_id, data: { boosterType: cType, qty: cQty, source: 'admin' } }),
      })
      if (!res.ok) throw new Error(await res.text())
      onMsg(`✅ ${cQty}x "${cType}" → ${modal.username}`)
      setModal(null)
    } catch (e: unknown) { onMsg(e instanceof Error ? e.message : 'Erreur', false) }
    finally { setCrediting(false) }
  }

  async function toggleCardBack(skinId: string) {
    if (!backModal) return
    const current = backModal.unlocked_card_backs ?? ['default']
    const has = current.includes(skinId)
    const next = has ? current.filter(id => id !== skinId) : [...current, skinId]

    setSavingBacks(true)
    try {
      const res = await fetch('/api/admin/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_card_backs', userId: backModal.user_id, data: { unlockedCardBacks: next } }),
      })
      if (!res.ok) throw new Error(await res.text())
      setBackModal({ ...backModal, unlocked_card_backs: next })
      setPlayers(ps => ps.map(p => p.user_id === backModal.user_id ? { ...p, unlocked_card_backs: next } : p))
    } catch (e: unknown) { onMsg(e instanceof Error ? e.message : 'Erreur', false) }
    finally { setSavingBacks(false) }
  }

  async function toggleArena(arenaId: string) {
    if (!arenaModal) return
    const current = arenaModal.owned_arenas ?? []
    const has = current.includes(arenaId)
    const next = has ? current.filter(id => id !== arenaId) : [...current, arenaId]

    setSavingArenas(true)
    try {
      const res = await fetch('/api/admin/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_arenas', userId: arenaModal.user_id, data: { ownedArenas: next } }),
      })
      if (!res.ok) throw new Error(await res.text())
      setArenaModal({ ...arenaModal, owned_arenas: next })
      setPlayers(ps => ps.map(p => p.user_id === arenaModal.user_id ? { ...p, owned_arenas: next } : p))
    } catch (e: unknown) { onMsg(e instanceof Error ? e.message : 'Erreur', false) }
    finally { setSavingArenas(false) }
  }

  const filtered = players.filter(p => !search || (p.username ?? '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className={inputCls + ' w-56'}
        />
        <button onClick={load} className={iconBtnCls} title="Rafraîchir"><RefreshCw size={13} /></button>
        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{filtered.length} joueurs</span>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
              {['Joueur', 'Niv', 'XP', 'Packs', 'Streak', 'Rôle', 'Actions'].map(h => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-xs uppercase tracking-widest font-semibold"
                  style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Cinzel, serif' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  Chargement…
                </td>
              </tr>
            ) : filtered.map((p, i) => (
              <tr
                key={p.user_id}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                }}
                className="transition-colors hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={p.avatar_url
                        ? { backgroundImage: `url(${p.avatar_url})`, backgroundSize: 'cover' }
                        : { background: 'linear-gradient(135deg,#7b2bff,#4a9e6a)' }
                      }
                    >
                      {!p.avatar_url && (p.username?.[0]?.toUpperCase() ?? '?')}
                    </div>
                    <span className="font-medium">{p.username ?? '-'}</span>
                    <SubscriberBadge isSubscriber={p.is_subscriber} />
                    <RoleBadge role={p.role} />
                  </div>
                </td>
                <td className="px-4 py-3 font-bold" style={{ color: '#a78bfa' }}>{p.level}</td>
                <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.6)' }}>{(p.xp ?? 0).toLocaleString('fr-FR')}</td>
                <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.6)' }}>{p.packs_opened ?? 0}</td>
                <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.6)' }}>{p.current_streak ?? 0}j</td>
                <td className="px-4 py-3">
                  <select
                    value={p.role ?? ''}
                    onChange={async e => {
                      const role = (e.target.value || null) as UserRole
                      setPlayers(ps => ps.map(q => q.user_id === p.user_id ? { ...q, role } : q))
                      await fetch('/api/admin/players', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'update_role', userId: p.user_id, data: { role } }),
                      })
                    }}
                    className={selectCls + ' text-xs py-1.5'}
                    style={{ width: 'auto' }}
                  >
                    <option value="">Aucun</option>
                    <option value="founder">Fondateur</option>
                    <option value="developer">Développeur</option>
                    <option value="artist">Artiste</option>
                    <option value="streamer">Streamer</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => { setModal(p); setCType('void'); setCQty(1) }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
                      style={{ background: 'rgba(123,43,255,0.15)', border: '1px solid rgba(123,43,255,0.3)', color: '#a78bfa' }}
                    >
                      Créditer
                    </button>
                    <button
                      onClick={() => setBackModal(p)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
                      style={{ background: 'rgba(255,94,91,0.12)', border: '1px solid rgba(255,94,91,0.25)', color: '#ff9a98' }}
                    >
                      Dos
                    </button>
                    <button
                      onClick={() => setArenaModal(p)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
                      style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fcd34d' }}
                    >
                      Arènes
                    </button>
                    <button
                      onClick={async () => {
                        const active = !p.is_subscriber
                        setPlayers(ps => ps.map(q => q.user_id === p.user_id ? { ...q, is_subscriber: active } : q))
                        await fetch('/api/admin/players', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'set_subscriber', userId: p.user_id, data: { active } }),
                        })
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
                      style={p.is_subscriber
                        ? { background: 'rgba(74,158,106,0.18)', border: '1px solid rgba(74,158,106,0.35)', color: '#6ee7a0' }
                        : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                    >
                      {p.is_subscriber ? '★ Abonné' : 'Abonné'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <p className="text-center py-8" style={{ color: 'rgba(255,255,255,0.25)' }}>Chargement…</p>
        ) : filtered.map(p => (
          <div
            key={p.user_id}
            className="p-4 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={p.avatar_url
                  ? { backgroundImage: `url(${p.avatar_url})`, backgroundSize: 'cover' }
                  : { background: 'linear-gradient(135deg,#7b2bff,#4a9e6a)' }
                }
              >
                {!p.avatar_url && (p.username?.[0]?.toUpperCase() ?? '?')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold truncate">{p.username ?? '-'}</span>
                  <SubscriberBadge isSubscriber={p.is_subscriber} />
                  <RoleBadge role={p.role} />
                </div>
                <div className="flex gap-3 text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  <span>Niv <span style={{ color: '#a78bfa' }}>{p.level}</span></span>
                  <span>{p.packs_opened ?? 0} packs</span>
                  <span>{p.current_streak ?? 0}j streak</span>
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => { setModal(p); setCType('void'); setCQty(1) }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: 'rgba(123,43,255,0.15)', border: '1px solid rgba(123,43,255,0.3)', color: '#a78bfa' }}
              >
                Créditer
              </button>
              <button
                onClick={() => setBackModal(p)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: 'rgba(255,94,91,0.12)', border: '1px solid rgba(255,94,91,0.25)', color: '#ff9a98' }}
              >
                Dos
              </button>
              <button
                onClick={() => setArenaModal(p)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fcd34d' }}
              >
                Arènes
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title="Créditer un booster" onClose={() => setModal(null)}>
          <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Joueur : <span className="text-white font-semibold">{modal.username}</span>
          </p>
          <Field label="Type de booster">
            <select value={cType} onChange={e => setCType(e.target.value)} className={selectCls}>
              {families.map(f => <option key={f.value} value={f.value} className="bg-[#0a0318]">{f.label}</option>)}
            </select>
          </Field>
          <Field label="Quantité">
            <input type="number" min={1} max={50} value={cQty} onChange={e => setCQty(Math.max(1,Math.min(50,+e.target.value||1)))} className={inputCls} />
          </Field>
          <ModalActions onCancel={() => setModal(null)} onConfirm={credit} loading={crediting} label="Créditer" />
        </Modal>
      )}

      {backModal && (
        <Modal title="Dos de carte" onClose={() => setBackModal(null)}>
          <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Joueur : <span className="text-white font-semibold">{backModal.username}</span>
          </p>
          <div className="space-y-2">
            {cardBacks.map(skin => {
              const owned = (backModal.unlocked_card_backs ?? ['default']).includes(skin.id!)
              return (
                <button
                  key={skin.id}
                  onClick={() => toggleCardBack(skin.id!)}
                  disabled={savingBacks || skin.id === 'default'}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors text-left disabled:opacity-50"
                  style={{
                    background: owned ? 'rgba(0,200,150,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${owned ? 'rgba(0,200,150,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ background: skin.gradient }} />
                    <span className="text-sm text-white">{skin.name}</span>
                    {skin.id === 'default' && <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>(toujours débloqué)</span>}
                  </div>
                  <span className={`text-sm font-bold ${owned ? 'text-emerald-400' : 'text-white/30'}`}>
                    {owned ? <><Check size={11} className="inline-block mr-0.5" />Débloqué</> : <><Lock size={11} className="inline-block mr-0.5" />Verrouillé</>}
                  </span>
                </button>
              )
            })}
          </div>
        </Modal>
      )}

      {arenaModal && (
        <Modal title="Arènes" onClose={() => setArenaModal(null)}>
          <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Joueur : <span className="text-white font-semibold">{arenaModal.username}</span>
          </p>
          <div className="space-y-2">
            {arenas.map(arena => {
              const owned = (arenaModal.owned_arenas ?? []).includes(arena.id!)
              return (
                <button
                  key={arena.id}
                  onClick={() => toggleArena(arena.id!)}
                  disabled={savingArenas}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors text-left disabled:opacity-50"
                  style={{
                    background: owned ? 'rgba(0,200,150,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${owned ? 'rgba(0,200,150,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-8 rounded-lg overflow-hidden flex-shrink-0"
                      style={arena.image_url ? {} : { background: arena.gradient ?? '#1a0a2e' }}
                    >
                      {arena.image_url && <img src={arena.image_url} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <span className="text-sm text-white">{arena.name}</span>
                  </div>
                  <span className={`text-sm font-bold ${owned ? 'text-emerald-400' : 'text-white/30'}`}>
                    {owned ? <><Check size={11} className="inline-block mr-0.5" />Débloqué</> : <><Lock size={11} className="inline-block mr-0.5" />Verrouillé</>}
                  </span>
                </button>
              )
            })}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Onglet Familles (via API route service role) ─────────────────────────────
function FamiliesTab({ onMsg }: { onMsg: (msg: string, ok?: boolean) => void }) {
  const [families, setFamilies] = useState<Family[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Family | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminDb('select', 'families', { order: 'order_index' })
      setFamilies(data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const empty: Family = { key: '', label: '', color: '#7b2bff', description: '' }

  async function save() {
    if (!form) return
    setSaving(true)
    try {
      const fields = { key: form.key, label: form.label, color: form.color, description: form.description }
      if (form._originalKey) {
        await adminDb('update', 'families', fields, { col: 'key', val: form._originalKey })
      } else {
        await adminDb('insert', 'families', fields)
      }
      onMsg(`✅ Famille "${form.label}" sauvegardée`)
      setForm(null); load()
    } catch (e: unknown) { onMsg(e instanceof Error ? e.message : 'Erreur', false) }
    finally { setSaving(false) }
  }

  async function del(fam: Family) {
    if (!confirm(`Supprimer "${fam.label}" ?`)) return
    await adminDb('delete', 'families', undefined, { col: 'key', val: fam.key })
    onMsg(`🗑 "${fam.label}" supprimée`); load()
  }

  async function toggleActive(fam: Family) {
    const cur = fam.active == null ? true : !!(fam.active as unknown as number | boolean)
    await adminDb('update', 'families', { active: !cur }, { col: 'key', val: fam.key })
    onMsg(cur ? `"${fam.label}" désactivée` : `"${fam.label}" activée`, true)
    load()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{families.length} famille(s)</p>
        <button onClick={() => setForm({ ...empty })} className={primaryBtnCls}>+ Nouvelle famille</button>
      </div>

      {loading ? <LoadingText /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {families.map(f => {
            const isActive = f.active == null ? true : !!(f.active as unknown as number | boolean)
            return (
            <div
              key={f.key}
              className="p-4 rounded-2xl flex items-start justify-between gap-3 transition-opacity"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${!isActive ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)'}`,
                opacity: !isActive ? 0.5 : 1,
              }}
            >
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ background: !isActive ? '#444' : f.color }} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{f.label}</p>
                    {!isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/30 font-bold">INACTIF</span>}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{f.key}</p>
                  {f.description && (
                    <p className="text-xs mt-1.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{f.description}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleActive(f)}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold transition-colors"
                  style={!isActive
                    ? { background: 'rgba(74,158,106,0.15)', color: '#6ee7a0', border: '1px solid rgba(74,158,106,0.3)' }
                    : { background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  {!isActive ? 'Activer' : 'Désactiver'}
                </button>
                <button onClick={() => setForm({ ...f, _originalKey: f.key } as Family)} className={iconBtnCls}><Pencil size={12} /></button>
                <button onClick={() => del(f)} className={dangerIconBtnCls}><X size={12} /></button>
              </div>
            </div>
            )
          })}
        </div>
      )}

      {form && (
        <Modal title={form._originalKey ? `Modifier "${form.label}"` : 'Nouvelle famille'} onClose={() => setForm(null)}>
          <Field label="Clé (ex: neon-divide)">
            <input value={form.key} onChange={e => setForm(f => f && ({ ...f, key: e.target.value }))} className={inputCls} placeholder="ma-famille" />
          </Field>
          <Field label="Nom affiché">
            <input value={form.label} onChange={e => setForm(f => f && ({ ...f, label: e.target.value }))} className={inputCls} placeholder="Ma Famille" />
          </Field>
          <Field label="Couleur">
            <div className="flex gap-3 items-center">
              <input type="color" value={form.color} onChange={e => setForm(f => f && ({ ...f, color: e.target.value }))} className="w-12 h-10 rounded-lg cursor-pointer bg-transparent border-0" />
              <input value={form.color} onChange={e => setForm(f => f && ({ ...f, color: e.target.value }))} className={`${inputCls} flex-1`} placeholder="#7b2bff" />
            </div>
          </Field>
          <Field label="Description (optionnel)">
            <textarea value={form.description} onChange={e => setForm(f => f && ({ ...f, description: e.target.value }))} className={`${inputCls} resize-none h-20`} />
          </Field>
          <ModalActions onCancel={() => setForm(null)} onConfirm={save} loading={saving} label={form._originalKey ? 'Modifier' : 'Créer'} />
        </Modal>
      )}
    </div>
  )
}

// ─── Onglet Dos de carte (via API route service role) ─────────────────────────
function CardBacksTab({ onMsg }: { onMsg: (msg: string, ok?: boolean) => void }) {
  const [backs, setBacks] = useState<CardBack[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<CardBack | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminDb('select', 'card_backs', { order: 'order_index' })
      setBacks(data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const empty: CardBack = {
    name: '', gradient: 'linear-gradient(135deg, #1a0b2e 0%, #4a1fa8 50%, #2a0a4d 100%)',
    pattern: 'radial-gradient(circle at 50% 50%, rgba(123,43,255,0.25), transparent 60%)',
    active: true, order_index: backs.length,
  }

  async function save() {
    if (!form) return
    setSaving(true)
    try {
      const fields = { name: form.name, gradient: form.gradient || null, pattern: form.pattern || null, image_url: form.image_url || null, order_index: form.order_index ?? 0, active: form.active ?? true }
      if (form.id) {
        await adminDb('update', 'card_backs', fields, { col: 'id', val: form.id })
      } else {
        const id = form.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        await adminDb('insert', 'card_backs', { id, ...fields })
      }
      onMsg(`✅ Dos "${form.name}" sauvegardé`)
      setForm(null); load()
    } catch (e: unknown) { onMsg(e instanceof Error ? e.message : 'Erreur', false) }
    finally { setSaving(false) }
  }

  async function del(back: CardBack) {
    if (back.id === 'default') { onMsg('Le dos "Originel" ne peut pas être supprimé', false); return }
    if (!confirm(`Supprimer "${back.name}" ?`)) return
    await adminDb('delete', 'card_backs', undefined, { col: 'id', val: back.id })
    onMsg(`🗑 "${back.name}" supprimé`); load()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{backs.length} dos de carte</p>
        <button onClick={() => setForm({ ...empty })} className={primaryBtnCls}>+ Nouveau dos</button>
      </div>

      {loading ? <LoadingText /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {backs.map(b => (
            <div
              key={b.id}
              className="rounded-2xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}
            >
              <div className="aspect-[0.714] relative overflow-hidden" style={b.image_url ? {} : { background: b.gradient }}>
                {b.image_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={b.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                  : <div className="absolute inset-0" style={{ background: b.pattern }} />
                }
                {!b.active && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Inactif
                  </div>
                )}
              </div>
              <div className="p-2.5 flex items-center justify-between gap-2">
                <span className="text-sm text-white truncate">{b.name}</span>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setForm({ ...b })} className={iconBtnCls}><Pencil size={12} /></button>
                  <button onClick={() => del(b)} className={dangerIconBtnCls}><X size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal title={form.id ? `Modifier "${form.name}"` : 'Nouveau dos de carte'} onClose={() => setForm(null)}>
          <Field label="Nom">
            <input value={form.name} onChange={e => setForm(f => f && ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Aurore Boréale" />
          </Field>
          <Field label="Image URL (prioritaire sur le gradient)">
            <input value={form.image_url ?? ''} onChange={e => setForm(f => f && ({ ...f, image_url: e.target.value }))} className={inputCls} placeholder="https://… (.png, .jpg, .webm, .gif)" />
          </Field>
          <Field label="Gradient CSS (si pas d'image)">
            <textarea value={form.gradient} onChange={e => setForm(f => f && ({ ...f, gradient: e.target.value }))} className={`${inputCls} resize-none h-16 font-mono text-xs`}
              placeholder="linear-gradient(135deg, #000 0%, #7b2bff 100%)" />
          </Field>
          <Field label="Motif/Overlay CSS (optionnel)">
            <textarea value={form.pattern} onChange={e => setForm(f => f && ({ ...f, pattern: e.target.value }))} className={`${inputCls} resize-none h-16 font-mono text-xs`}
              placeholder="radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15), transparent 60%)" />
          </Field>
          <Field label="Aperçu">
            <div className="aspect-[0.714] w-32 rounded-xl relative overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              {form.image_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={form.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                : <>
                    <div className="absolute inset-0" style={{ background: form.gradient }} />
                    <div className="absolute inset-0" style={{ background: form.pattern }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ border: '2px solid rgba(255,255,255,0.3)' }}>
                        <div className="w-4 h-4 rounded-full" style={{ background: 'rgba(255,255,255,0.4)' }} />
                      </div>
                    </div>
                  </>
              }
            </div>
          </Field>
          <Field label="Ordre d'affichage">
            <input type="number" value={form.order_index ?? 0} onChange={e => setForm(f => f && ({ ...f, order_index: +e.target.value || 0 }))} className={inputCls} />
          </Field>
          <Field label="Actif (visible dans la boutique)">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active ?? true} onChange={e => setForm(f => f && ({ ...f, active: e.target.checked }))} className="w-4 h-4" />
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Visible</span>
            </label>
          </Field>
          <ModalActions onCancel={() => setForm(null)} onConfirm={save} loading={saving} label={form.id ? 'Modifier' : 'Créer'} />
        </Modal>
      )}
    </div>
  )
}


// ─── Onglet Arènes (fonds de combat) ──────────────────────────────────────────
function ArenasTab({ onMsg }: { onMsg: (msg: string, ok?: boolean) => void }) {
  const [arenas, setArenas] = useState<Arena[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Arena | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminDb('select', 'arena_backgrounds', { order: 'order_index' })
      setArenas(data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const empty: Arena = {
    name: '', image_url: '', gradient: 'linear-gradient(180deg, #050210 0%, #08031a 50%, #050210 100%)',
    active: true, order_index: arenas.length,
  }

  async function save() {
    if (!form) return
    setSaving(true)
    try {
      const fields = { name: form.name, image_url: form.image_url || null, gradient: form.gradient || null, order_index: form.order_index ?? 0, active: form.active ?? true }
      if (form.id) {
        await adminDb('update', 'arena_backgrounds', fields, { col: 'id', val: form.id })
      } else {
        const id = form.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        await adminDb('insert', 'arena_backgrounds', { id, ...fields })
      }
      onMsg(`✅ Arène "${form.name}" sauvegardée`)
      setForm(null); load()
    } catch (e: unknown) { onMsg(e instanceof Error ? e.message : 'Erreur', false) }
    finally { setSaving(false) }
  }

  async function del(arena: Arena) {
    if (arena.id === 'default') { onMsg('L\'arène par défaut ne peut pas être supprimée', false); return }
    if (!confirm(`Supprimer "${arena.name}" ?`)) return
    await adminDb('delete', 'arena_backgrounds', undefined, { col: 'id', val: arena.id })
    onMsg(`🗑 "${arena.name}" supprimée`); load()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {arenas.length} arène{arenas.length > 1 ? 's' : ''}
        </p>
        <button onClick={() => setForm({ ...empty })} className={primaryBtnCls}>+ Nouvelle arène</button>
      </div>

      {loading ? <LoadingText /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {arenas.map(a => (
            <div
              key={a.id}
              className="rounded-2xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}
            >
              <div className="aspect-[16/9] relative overflow-hidden" style={a.image_url ? {} : { background: a.gradient }}>
                {a.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                )}
                {!a.active && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Inactif
                  </div>
                )}
              </div>
              <div className="p-2.5 flex items-center justify-between gap-2">
                <span className="text-sm text-white truncate">{a.name}</span>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setForm({ ...a })} className={iconBtnCls}><Pencil size={12} /></button>
                  <button onClick={() => del(a)} className={dangerIconBtnCls}><X size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal title={form.id ? `Modifier "${form.name}"` : 'Nouvelle arène'} onClose={() => setForm(null)}>
          <Field label="Nom">
            <input value={form.name} onChange={e => setForm(f => f && ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Temple Céleste" />
          </Field>
          <Field label="Image URL (paysage, prioritaire sur le gradient)">
            <input value={form.image_url ?? ''} onChange={e => setForm(f => f && ({ ...f, image_url: e.target.value }))} className={inputCls} placeholder="/assets/bg-arene.png ou https://…" />
          </Field>
          <Field label="Gradient CSS (si pas d'image)">
            <textarea value={form.gradient ?? ''} onChange={e => setForm(f => f && ({ ...f, gradient: e.target.value }))} className={`${inputCls} resize-none h-16 font-mono text-xs`}
              placeholder="linear-gradient(180deg, #050210, #08031a)" />
          </Field>
          <Field label="Aperçu">
            <div
              className="aspect-[16/9] w-48 rounded-xl relative overflow-hidden"
              style={form.image_url
                ? { border: '1px solid rgba(255,255,255,0.1)' }
                : { background: form.gradient, border: '1px solid rgba(255,255,255,0.1)' }
              }
            >
              {form.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )}
            </div>
          </Field>
          <Field label="Ordre d'affichage">
            <input type="number" value={form.order_index ?? 0} onChange={e => setForm(f => f && ({ ...f, order_index: +e.target.value || 0 }))} className={inputCls} />
          </Field>
          <Field label="Active (visible dans la boutique)">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active ?? true} onChange={e => setForm(f => f && ({ ...f, active: e.target.checked }))} className="w-4 h-4" />
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Visible</span>
            </label>
          </Field>
          <ModalActions onCancel={() => setForm(null)} onConfirm={save} loading={saving} label={form.id ? 'Modifier' : 'Créer'} />
        </Modal>
      )}
    </div>
  )
}


function CardsTab({ onMsg }: { onMsg: (msg: string, ok?: boolean) => void }) {
  const [cards, setCards]       = useState<Card[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState<Card | null>(null)
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')
  const [filterFam, setFilterFam] = useState('')
  const [filterRarity, setFilterRarity] = useState('')
  const [filterArtist, setFilterArtist] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [artists, setArtists]   = useState<{ id: number; name: string; url: string | null }[]>([])
  const [artistOpen, setArtistOpen] = useState(false)
  const artistRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (artistRef.current && !artistRef.current.contains(e.target as Node)) setArtistOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const empty: Card = { name: '', family: '', rarity: 'common', image_url: '', combat_atk: 1, combat_hp: 2, combat_cost: 1, combat_effects: [], artist: '', artistUrl: '' }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminDb('select', 'custom_cards', { order: 'name' })
      setCards((data ?? []).map((c: Card & { metadata: unknown; artist_url?: string }) => ({
        ...c,
        artist:    c.artist ?? '',
        artistUrl: c.artist_url ?? c.artistUrl ?? '',
        metadata: typeof c.metadata === 'string' ? (() => { try { return JSON.parse(c.metadata) } catch { return {} } })() : (c.metadata ?? {}),
      })))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    adminDb('select', 'families', { order: 'label' }).then(data => setFamilies(data ?? [])).catch(() => {})
    adminDb('select', 'artists', { order: 'name' }).then(data => setArtists(data ?? [])).catch(() => {})
  }, [load])


  async function save() {
    if (!form) return
    if (!form.artist?.trim()) { onMsg('Un artiste est requis pour créer la carte.', false); return }
    setSaving(true)
    try {
      const fields = {
        name: form.name, family: form.family, rarity: form.rarity,
        image_url: form.image_url,
        artist: form.artist.trim(),
        artist_url: form.artistUrl?.trim() || null,
        description: (form.description ?? '').trim(),
        metadata: JSON.stringify({ combat: { atk: form.combat_atk, hp: form.combat_hp, cost: form.combat_cost, effects: form.combat_effects } })
      }
      if (form.id) {
        await adminDb('update', 'custom_cards', fields, { col: 'id', val: form.id })
      } else {
        const newId = form.name.toLowerCase().replace(/\s+/g, '-')
        await adminDb('insert', 'custom_cards', { id: newId, ...fields })
      }
      onMsg(`✅ Carte "${form.name}" sauvegardée`)
      setForm(null); load()
    } catch (e: unknown) { onMsg(e instanceof Error ? e.message : 'Erreur', false) }
    finally { setSaving(false) }
  }

  async function del(card: Card) {
    if (!confirm(`Supprimer "${card.name}" ?`)) return
    await adminDb('delete', 'custom_cards', undefined, { col: 'id', val: card.id })
    onMsg(`🗑 "${card.name}" supprimée`); load()
  }

  const RARITY_COLOR: Record<string, string> = { void: '#7b2bff', legendary: '#f59e0b', epic: '#ec4899', rare: '#3b82f6', common: '#9ca3af' }

  // Sépare le tag artiste de la description libre (pour pré-remplir l'édition)
  function splitArtist(desc?: string) {
    const m = (desc ?? '').match(/artiste?\s*:?\s*([^[\n]+)(?:\[([^\]]+)\])?/i)
    return {
      artist:    m?.[1]?.trim() ?? '',
      artistUrl: m?.[2]?.trim() ?? '',
      text:      (desc ?? '').replace(/artiste?\s*:?[^\n]*/i, '').trim(),
    }
  }

  const filtered = cards.filter(c =>
    (!search || c.name.toLowerCase().includes(search.toLowerCase())) &&
    (!filterFam || c.family === filterFam) &&
    (!filterRarity || c.rarity === filterRarity) &&
    (!filterArtist || c.artist === filterArtist)
  )

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une carte…"
          className={inputCls}
        />
        <div className="grid grid-cols-3 gap-2">
          <select value={filterFam} onChange={e => setFilterFam(e.target.value)} className={selectCls}>
            <option value="">Toutes les familles</option>
            {families.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select value={filterRarity} onChange={e => setFilterRarity(e.target.value)} className={selectCls}>
            <option value="">Toutes raretés</option>
            {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterArtist} onChange={e => setFilterArtist(e.target.value)} className={selectCls}>
            <option value="">Tous les artistes</option>
            {artists.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold px-3 py-1 rounded-lg" style={{ color: '#a78bfa', background: 'rgba(123,43,255,0.12)', border: '1px solid rgba(123,43,255,0.25)' }}>
            {filtered.length} carte{filtered.length !== 1 ? 's' : ''}
          </span>
          <div className="flex rounded-xl overflow-hidden border border-white/10">
            <button onClick={() => setViewMode('grid')}
              className="px-3 py-1.5 text-xs font-bold transition-colors"
              style={{ background: viewMode === 'grid' ? 'rgba(123,43,255,0.35)' : 'transparent', color: viewMode === 'grid' ? '#a78bfa' : 'rgba(255,255,255,0.35)' }}>
              ⊞ Cartes
            </button>
            <button onClick={() => setViewMode('list')}
              className="px-3 py-1.5 text-xs font-bold transition-colors border-l border-white/10"
              style={{ background: viewMode === 'list' ? 'rgba(123,43,255,0.35)' : 'transparent', color: viewMode === 'list' ? '#a78bfa' : 'rgba(255,255,255,0.35)' }}>
              ☰ Liste
            </button>
          </div>
          <button onClick={() => setForm({ ...empty })} className={primaryBtnCls}>+ Nouvelle carte</button>
        </div>
      </div>

      {loading ? <LoadingText /> : (
        filtered.length === 0 ? (
          <p className="text-center py-12" style={{ color: 'rgba(255,255,255,0.25)' }}>Aucune carte.</p>
        ) : viewMode === 'list' ? (
          /* ── Vue liste ── */
          <div className="rounded-xl overflow-hidden border border-white/[0.07]">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <th className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white/40 w-8"></th>
                  <th className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white/40">Nom</th>
                  <th className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white/40">Famille</th>
                  <th className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white/40">Rareté</th>
                  <th className="text-center px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white/40">⚔</th>
                  <th className="text-center px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white/40">♥</th>
                  <th className="text-center px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white/40">◆</th>
                  <th className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white/40">Effets</th>
                  <th className="text-right px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white/40"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    <td className="px-3 py-1.5">
                      <div className="w-6 h-8 rounded overflow-hidden bg-[#0a0612] flex-shrink-0">
                        {c.image_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-white/10 text-[8px]">?</div>}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 font-semibold text-white">{c.name}</td>
                    <td className="px-3 py-1.5 text-white/50 text-xs">{c.family || '-'}</td>
                    <td className="px-3 py-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase" style={{ color: RARITY_COLOR[c.rarity], background: RARITY_COLOR[c.rarity] + '22' }}>{c.rarity}</span>
                    </td>
                    <td className="px-3 py-1.5 text-center text-xs font-bold" style={{ color: '#f87171' }}>{c.metadata?.combat?.atk ?? '?'}</td>
                    <td className="px-3 py-1.5 text-center text-xs font-bold" style={{ color: '#60a5fa' }}>{c.metadata?.combat?.hp ?? '?'}</td>
                    <td className="px-3 py-1.5 text-center text-xs font-bold" style={{ color: '#a78bfa' }}>{c.metadata?.combat?.cost ?? '?'}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex gap-1 flex-wrap">
                        {(c.metadata?.combat?.effects ?? []).map((e: string) => (
                          <span key={e} className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-white/10 text-white/60">{e}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => { const a = splitArtist(c.description); setForm({ ...c, artist: c.artist || a.artist, artistUrl: c.artistUrl || a.artistUrl, description: c.artist ? (c.description ?? '') : a.text, combat_atk: c.metadata?.combat?.atk ?? 1, combat_hp: c.metadata?.combat?.hp ?? 2, combat_cost: c.metadata?.combat?.cost ?? 1, combat_effects: c.metadata?.combat?.effects ?? [] }) }}
                          className={iconBtnCls}><Pencil size={11} /></button>
                        <button onClick={() => del(c)} className={dangerIconBtnCls}><X size={11} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── Vue grille (12 par row) ── */
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
            {filtered.map(c => (
              <div
                key={c.id}
                className="rounded-xl overflow-hidden flex flex-col"
                style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${RARITY_COLOR[c.rarity]}44` }}
              >
                <div className="aspect-[0.714] relative overflow-hidden bg-[#0a0612]">
                  {c.image_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={c.image_url} alt={c.name} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                    : <div className="absolute inset-0 flex items-center justify-center opacity-20 text-lg">?</div>
                  }
                  <span
                    className="absolute top-1 left-1 text-[7px] font-bold px-1 py-0.5 rounded-full uppercase tracking-wider"
                    style={{ color: RARITY_COLOR[c.rarity], background: RARITY_COLOR[c.rarity] + '33', backdropFilter: 'blur(8px)', border: `1px solid ${RARITY_COLOR[c.rarity]}55` }}
                  >
                    {c.rarity.slice(0, 3)}
                  </span>
                  <div className="absolute bottom-0 left-0 right-0 px-1 py-1 flex justify-between text-[8px] font-bold" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}>
                    <span style={{ color: '#f87171' }}>⚔{c.metadata?.combat?.atk ?? '?'}</span>
                    <span style={{ color: '#60a5fa' }}>♥{c.metadata?.combat?.hp ?? '?'}</span>
                    <span style={{ color: '#a78bfa' }}>◆{c.metadata?.combat?.cost ?? '?'}</span>
                  </div>
                </div>
                <div className="px-1 py-1 flex items-center justify-between gap-0.5">
                  <span className="text-[9px] text-white truncate font-semibold leading-tight">{c.name}</span>
                  <div className="flex gap-0.5 flex-shrink-0">
                    <button onClick={() => { const a = splitArtist(c.description); setForm({ ...c, artist: c.artist || a.artist, artistUrl: c.artistUrl || a.artistUrl, description: c.artist ? (c.description ?? '') : a.text, combat_atk: c.metadata?.combat?.atk ?? 1, combat_hp: c.metadata?.combat?.hp ?? 2, combat_cost: c.metadata?.combat?.cost ?? 1, combat_effects: c.metadata?.combat?.effects ?? [] }) }}
                      className="w-5 h-5 rounded flex items-center justify-center bg-white/5 hover:bg-white/10"><Pencil size={8} /></button>
                    <button onClick={() => del(c)}
                      className="w-5 h-5 rounded flex items-center justify-center bg-red-500/10 hover:bg-red-500/25 text-red-400"><X size={8} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {form && (
        <Modal title={form.id ? `Modifier "${form.name}"` : 'Nouvelle carte'} onClose={() => setForm(null)} wide>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nom"><input value={form.name} onChange={e => setForm(f => f && ({ ...f, name: e.target.value }))} className={inputCls} /></Field>
            <Field label="Clé (auto si vide)"><input value={form.id ?? ''} onChange={e => setForm(f => f && ({ ...f, id: e.target.value }))} className={inputCls} placeholder="auto" /></Field>
            <Field label="Famille">
              <select value={form.family} onChange={e => setForm(f => f && ({ ...f, family: e.target.value }))} className={selectCls}>
                <option value="">Aucune</option>
                {families.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </Field>
            <Field label="Rareté">
              <select value={form.rarity} onChange={e => setForm(f => f && ({ ...f, rarity: e.target.value }))} className={selectCls}>
                {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="ATK"><input type="number" min={0} value={form.combat_atk} onChange={e => setForm(f => f && ({ ...f, combat_atk: +e.target.value }))} className={inputCls} /></Field>
            <Field label="HP"><input type="number" min={1} value={form.combat_hp} onChange={e => setForm(f => f && ({ ...f, combat_hp: +e.target.value }))} className={inputCls} /></Field>
            <Field label="Coût mana"><input type="number" min={0} max={10} value={form.combat_cost} onChange={e => setForm(f => f && ({ ...f, combat_cost: +e.target.value }))} className={inputCls} /></Field>
            <div className="col-span-1 sm:col-span-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/30 mb-2">Effets</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {([
                  { key: 'taunt',      label: 'Provocation',  desc: 'Doit être attaqué en premier', color: '#ff7820' },
                  { key: 'charge',     label: 'Charge',        desc: 'Peut attaquer immédiatement', color: '#50c850' },
                  { key: 'shield',     label: 'Bouclier',      desc: 'Absorbe la première attaque',  color: '#2090ff' },
                  { key: 'lifesteal',  label: 'Vol de vie',    desc: "Soigne le héros à l'attaque", color: '#e02850' },
                  { key: 'void_surge', label: 'VOID Surge',    desc: '1 dégât à tous les ennemis',   color: '#8200ff' },
                  { key: 'stealth',    label: 'Furtivité',     desc: 'Ne peut pas être ciblé',       color: '#6060a0' },
                ] as const).map(({ key, label, desc, color }) => {
                  const checked = (form.combat_effects ?? []).includes(key)
                  return (
                    <label key={key} className={`flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all ${checked ? 'border-opacity-60 bg-opacity-10' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/20'}`}
                      style={checked ? { borderColor: color + '60', background: color + '15' } : {}}>
                      <input type="checkbox" className="mt-0.5 accent-[#7b2bff]"
                        checked={checked}
                        onChange={e => setForm(f => {
                          if (!f) return f
                          const effects = f.combat_effects ?? []
                          return { ...f, combat_effects: e.target.checked ? [...effects, key] : effects.filter(x => x !== key) }
                        })} />
                      <div>
                        <div className="text-xs font-bold text-white" style={{ color: checked ? color : undefined }}>{label}</div>
                        <div className="text-[10px] text-white/30 leading-tight mt-0.5">{desc}</div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
            <div className="col-span-1 sm:col-span-2">
              <Field label="URL artwork"><input value={form.image_url} onChange={e => setForm(f => f && ({ ...f, image_url: e.target.value }))} className={inputCls} placeholder="https://…" /></Field>
            </div>
            <div className="col-span-1 sm:col-span-2">
              <Field label="Description">
                <textarea value={form.description ?? ''} onChange={e => setForm(f => f && ({ ...f, description: e.target.value }))} className={`${inputCls} resize-none h-20`} />
              </Field>
            </div>
            <div className="col-span-1 sm:col-span-2">
              <Field label="Artiste *">
                <div ref={artistRef} className="relative">
                  <button type="button" onClick={() => setArtistOpen(v => !v)}
                    className={`${inputCls} flex items-center justify-between text-left w-full`}>
                    <span style={form.artist ? {} : { color: 'rgba(255,255,255,0.35)' }}>
                      {form.artist || 'Choisir un artiste'}
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      className={`shrink-0 transition-transform ${artistOpen ? 'rotate-180' : ''}`} style={{ opacity: .5 }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {artistOpen && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 z-50 max-h-56 overflow-y-auto rounded-xl"
                      style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}>
                      {form.artist && (
                        <button type="button"
                          onClick={() => { setForm(f => f && ({ ...f, artist: '', artistUrl: '' })); setArtistOpen(false) }}
                          className="w-full text-left px-4 py-2 text-xs transition-colors hover:bg-white/5"
                          style={{ color: 'rgba(255,255,255,0.3)' }}>
                          Aucun
                        </button>
                      )}
                      {artists.length === 0 && (
                        <p className="px-4 py-2.5 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Aucun artiste - gérer dans l&apos;onglet Artistes</p>
                      )}
                      {artists.map(a => (
                        <button key={a.id} type="button"
                          onClick={() => { setForm(f => f && ({ ...f, artist: a.name, artistUrl: a.url ?? '' })); setArtistOpen(false) }}
                          className="w-full text-left px-4 py-2 text-xs font-bold transition-colors"
                          style={form.artist === a.name
                            ? { color: '#a78bfa', background: 'rgba(123,43,255,0.15)' }
                            : { color: 'rgba(255,255,255,0.6)' }
                          }>
                          {a.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
            </div>
          </div>
          <ModalActions onCancel={() => setForm(null)} onConfirm={save} loading={saving} label={form.id ? 'Modifier' : 'Créer'} />
        </Modal>
      )}
    </div>
  )
}

// ─── Onglet Boosters (via API route service role) ─────────────────────────────
function BoostersTab({ onMsg }: { onMsg: (msg: string, ok?: boolean) => void }) {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [families, setFamilies] = useState<Family[]>([])

  useEffect(() => {
    adminDb('select', 'settings', { select: 'key,value' }).then((data) => {
      const map: Record<string, string> = {}
      ;((data ?? []) as Setting[]).forEach((s) => { map[s.key] = s.value })
      setSettings(map)
      setLoading(false)
    }).catch(() => setLoading(false))
    adminDb('select', 'families', { select: 'key,label', order: 'label' }).then(data => setFamilies(data ?? [])).catch(() => {})
  }, [])

  async function save(key: string, value: string) {
    setSaving(true)
    try {
      await adminDb('upsert', 'settings', { key, value }, { col: 'key', val: key, onConflict: 'key' })
      setSettings(s => ({ ...s, [key]: value }))
      onMsg('✅ Image sauvegardée')
    } catch (e: unknown) { onMsg(e instanceof Error ? e.message : 'Erreur', false) }
    finally { setSaving(false) }
  }

  const allKeys = [
    { key: 'booster_image_void',  label: 'VOID Pack' },
    { key: 'booster_image_dos',   label: 'Dos de carte (global)' },
    ...(families.map(f => ({ key: `booster_image_${f.key}`, label: `${f.label} Pack` }))),
  ]

  return (
    <div>
      <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Configure les images des boosters. Colle une URL d&apos;image publique (Imgur, CDN, Supabase Storage…)
      </p>
      {loading ? <LoadingText /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {allKeys.map(({ key, label }) => (
            <div
              key={key}
              className="p-4 rounded-2xl flex gap-4 items-start"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {/* Carte booster preview */}
              <div
                className="flex-shrink-0 rounded-xl overflow-hidden"
                style={{ width: 64, aspectRatio: '0.714', border: '1px solid rgba(255,255,255,0.12)', background: '#0a0612' }}
              >
                {settings[key]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={settings[key]} alt="" className="w-full h-full object-cover" style={{ display: 'block' }} />
                  : <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>?</div>
                }
              </div>
              {/* Champ URL */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold mb-2 text-white">{label}</p>
                <input
                  defaultValue={settings[key] ?? ''}
                  onBlur={e => { if (e.target.value !== settings[key]) save(key, e.target.value) }}
                  placeholder="https://…"
                  className={`${inputCls} text-xs`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {saving && <p className="text-emerald-400 text-xs mt-3">Sauvegarde…</p>}
    </div>
  )
}

// ─── Onglet Paramètres (via API route service role) ───────────────────────────
const FEATURE_FLAGS = [
  { key: 'feature_combat_multiplayer', label: 'Combat multijoueur',  desc: 'Matchmaking + défis entre joueurs',   icon: '⚔️' },
  { key: 'feature_combat_training',    label: 'Combat entraînement', desc: 'Combat contre le bot',                icon: '🤖' },
  { key: 'feature_pack_opening',       label: 'Ouverture de packs',  desc: 'Ouvrir des boosters',                 icon: '📦' },
  { key: 'feature_trading',            label: 'Échange de cartes',   desc: 'Trades entre joueurs',                icon: '🔄' },
  { key: 'feature_social',             label: 'Social / Chat',       desc: 'Messages, amis, communauté',          icon: '💬' },
  { key: 'feature_shop',               label: 'Boutique arènes',     desc: 'Achat d\'arènes et objets',           icon: '🏪' },
]

function FeatureToggle({ featureKey, label, desc, icon, value, onChange }: {
  featureKey: string; label: string; desc: string; icon: string
  value: boolean; onChange: (key: string, val: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-2xl"
      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${value ? 'rgba(74,158,106,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <p className="text-sm font-bold text-white">{label}</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{desc}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(featureKey, !value)}
        className="relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-200"
        style={{ background: value ? '#4a9e6a' : 'rgba(255,255,255,0.1)' }}
      >
        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: value ? 'translateX(24px)' : 'translateX(0)' }} />
      </button>
    </div>
  )
}

// ─── Twitch : streamers connectés + mapping rewards → boosters ─────────────────
interface TwitchStreamer {
  broadcasterId: string
  broadcasterLogin: string
  userId: string | null
  active: boolean
  subscriptionId: string | null
  createdAt: string
}
interface TwitchReward {
  id: number
  broadcasterId: string
  rewardId: string
  rewardTitle: string | null
  rewardCost: number | null
  boosterType: string | null
  quantity: number
  active: boolean
}

function TwitchTab({ onMsg }: { onMsg: (msg: string, ok?: boolean) => void }) {
  const [streamers, setStreamers] = useState<TwitchStreamer[]>([])
  const [rewards, setRewards]     = useState<TwitchReward[]>([])
  const [boosterOptions, setBoosterOptions] = useState<{ value: string; label: string }[]>([{ value: 'void', label: 'VOID Pack (global)' }])
  const [voidMsg, setVoidMsg]           = useState('')
  const [legendaryMsg, setLegendaryMsg] = useState('')
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [tw, fams] = await Promise.all([
      fetch('/api/admin/twitch').then(r => r.ok ? r.json() : { streamers: [], rewards: [] }),
      fetch('/api/families').then(r => r.ok ? r.json() : []).catch(() => []),
    ])
    setStreamers(tw.streamers ?? [])
    setRewards(tw.rewards ?? [])
    if (tw.messages) { setVoidMsg(tw.messages.void ?? ''); setLegendaryMsg(tw.messages.legendary ?? '') }
    const opts = [{ value: 'void', label: 'VOID Pack (global)' }]
    for (const f of (fams as { key: string; label: string }[])) {
      if (f.key && f.key !== 'global' && f.key !== 'void') opts.push({ value: f.key, label: `${f.label} Pack` })
    }
    setBoosterOptions(opts)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function post(action: string, data: Record<string, unknown>) {
    const res = await fetch('/api/admin/twitch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, data }),
    })
    if (res.ok) { onMsg('Mis à jour', true); load() }
    else onMsg('Erreur', false)
  }

  async function saveReward(r: TwitchReward) {
    await post('map_reward', { id: r.id, boosterType: r.boosterType, quantity: r.quantity, active: r.active })
  }

  function patchReward(id: number, patch: Partial<TwitchReward>) {
    setRewards(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  if (loading) return <div className="text-white/40 text-sm p-4">Chargement…</div>

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-white font-bold text-sm mb-2 flex items-center gap-2"><Tv2 size={15} className="text-[#9146FF]" /> Chaînes connectées</h3>
        {streamers.length === 0 ? (
          <p className="text-white/40 text-xs">Aucune chaîne connectée. Un streamer se connecte via le bouton « Connecter ma chaîne » sur son profil.</p>
        ) : (
          <div className="space-y-2">
            {streamers.map(s => (
              <div key={s.broadcasterId} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                <div>
                  <p className="text-white text-sm font-semibold">{s.broadcasterLogin}</p>
                  <p className="text-white/40 text-[11px]">
                    {s.subscriptionId ? '✅ EventSub actif' : '⚠️ Pas d\'abonnement EventSub'}
                  </p>
                </div>
                <button
                  onClick={() => post('toggle_streamer', { broadcasterId: s.broadcasterId, active: !s.active })}
                  className={`text-xs px-3 py-1 rounded-md font-semibold ${s.active ? 'bg-[#4a9e6a]/20 text-[#6ee7a0]' : 'bg-white/10 text-white/50'}`}
                >{s.active ? 'Actif' : 'Inactif'}</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-white font-bold text-sm mb-2">Rewards Channel Points → Boosters</h3>
        <p className="text-white/40 text-[11px] mb-3">Les rewards apparaissent automatiquement dès leur première utilisation. Assigne un booster à chacun.</p>
        {rewards.length === 0 ? (
          <p className="text-white/40 text-xs">Aucun reward détecté pour l&apos;instant.</p>
        ) : (
          <div className="space-y-2">
            {rewards.map(r => (
              <div key={r.id} className="bg-white/5 rounded-lg px-3 py-2 flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[140px]">
                  <p className="text-white text-sm font-semibold">{r.rewardTitle ?? r.rewardId}</p>
                  {r.rewardCost != null && <p className="text-white/40 text-[11px]">{r.rewardCost} points</p>}
                  {!r.boosterType && <p className="text-amber-400 text-[11px]">⚠️ Non mappé</p>}
                </div>
                <select value={r.boosterType ?? ''} onChange={e => patchReward(r.id, { boosterType: e.target.value || null })}
                  className="bg-black/40 border border-white/10 rounded-md text-white text-xs px-2 py-1.5">
                  <option value="">Aucun</option>
                  {boosterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input type="number" min={1} value={r.quantity}
                  onChange={e => patchReward(r.id, { quantity: Math.max(1, Number(e.target.value)) })}
                  className="w-14 bg-black/40 border border-white/10 rounded-md text-white text-xs px-2 py-1.5" title="Quantité de boosters" />
                <button onClick={() => patchReward(r.id, { active: !r.active })}
                  className={`text-[11px] px-2 py-1.5 rounded-md font-semibold ${r.active ? 'bg-[#4a9e6a]/20 text-[#6ee7a0]' : 'bg-white/10 text-white/50'}`}
                >{r.active ? 'On' : 'Off'}</button>
                <button onClick={() => saveReward(r)} className="text-[11px] px-3 py-1.5 rounded-md font-semibold bg-[#9146FF]/20 text-[#c4a7ff]">Enregistrer</button>
                <button onClick={() => post('delete_reward', { id: r.id })} className="text-white/30 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-white font-bold text-sm mb-2">Messages de félicitations (chat)</h3>
        <p className="text-white/40 text-[11px] mb-3">
          Envoyés dans le chat du streamer quand un viewer pull une carte rare. Variables : <code className="text-[#c4a7ff]">{'{viewer}'}</code> = nom du viewer, <code className="text-[#c4a7ff]">{'{card}'}</code> = nom de la carte.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-white/60 text-xs font-semibold block mb-1">Message VOID ⬛</label>
            <textarea value={voidMsg} onChange={e => setVoidMsg(e.target.value)} rows={2}
              className="w-full bg-black/40 border border-white/10 rounded-lg text-white text-xs px-3 py-2 resize-none" />
          </div>
          <div>
            <label className="text-white/60 text-xs font-semibold block mb-1">Message Légendaire 🌟</label>
            <textarea value={legendaryMsg} onChange={e => setLegendaryMsg(e.target.value)} rows={2}
              className="w-full bg-black/40 border border-white/10 rounded-lg text-white text-xs px-3 py-2 resize-none" />
          </div>
          <button onClick={() => post('save_messages', { voidMsg, legendaryMsg })}
            className="text-xs px-4 py-2 rounded-lg font-semibold bg-[#9146FF]/20 text-[#c4a7ff]">
            Enregistrer les messages
          </button>
        </div>
      </div>
    </div>
  )
}

function ArtistsTab({ onMsg }: { onMsg: (msg: string, ok?: boolean) => void }) {
  const [artists, setArtists]     = useState<{ id: number; name: string; url: string | null }[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [editId, setEditId]       = useState<number | null>(null)
  const [form, setForm]           = useState({ name: '', url: '' })
  const [isNew, setIsNew]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setArtists((await adminDb('select', 'artists', { order: 'name' })) ?? []) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (isNew) {
        await adminDb('insert', 'artists', { name: form.name.trim(), url: form.url.trim() || null })
      } else {
        await adminDb('update', 'artists', { id: editId, name: form.name.trim(), url: form.url.trim() || null })
      }
      await load()
      setEditId(null); setIsNew(false); setForm({ name: '', url: '' })
      onMsg(isNew ? 'Artiste ajouté.' : 'Artiste modifié.')
    } catch { onMsg('Erreur.', false) }
    finally { setSaving(false) }
  }

  async function del(id: number) {
    if (!confirm('Supprimer cet artiste ?')) return
    try {
      await adminDb('delete', 'artists', { id })
      setArtists(prev => prev.filter(a => a.id !== id))
      onMsg('Artiste supprimé.')
    } catch { onMsg('Erreur.', false) }
  }

  const inputCls = 'w-full px-3 py-2 rounded-xl text-sm outline-none bg-white/[0.04] border border-white/10 text-white placeholder:text-white/25 focus:border-[#7b2bff]/50'

  return (
    <div className="p-4 max-w-xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2"><Palette size={14} className="text-[#a78bfa]" /> Artistes</h2>
        {!isNew && !editId && (
          <button onClick={() => { setIsNew(true); setForm({ name: '', url: '' }) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
            style={{ background: 'rgba(123,43,255,0.2)', border: '1px solid rgba(123,43,255,0.4)', color: '#a78bfa' }}>
            <Plus size={12} /> Nouvel artiste
          </button>
        )}
      </div>

      {(isNew || editId !== null) && (
        <div className="p-4 rounded-2xl space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(123,43,255,0.2)' }}>
          <p className="text-xs font-bold text-[#a78bfa] uppercase tracking-wider">{isNew ? 'Nouvel artiste' : 'Modifier'}</p>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className={inputCls} placeholder="Nom de l'artiste *" />
          <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
            className={inputCls} placeholder="URL (portfolio, twitter…)" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setIsNew(false); setEditId(null); setForm({ name: '', url: '' }) }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white/40 hover:text-white/60 transition-colors">Annuler</button>
            <button onClick={save} disabled={saving || !form.name.trim()}
              className="px-4 py-1.5 rounded-xl text-xs font-bold transition-colors"
              style={{ background: 'rgba(123,43,255,0.3)', border: '1px solid rgba(123,43,255,0.4)', color: '#a78bfa' }}>
              {saving ? 'Sauvegarde…' : isNew ? 'Créer' : 'Modifier'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-white/30 text-sm text-center py-8">Chargement…</p>
      ) : artists.length === 0 ? (
        <p className="text-white/20 text-sm text-center py-8">Aucun artiste enregistré.</p>
      ) : (
        <div className="space-y-2">
          {artists.map(a => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{a.name}</p>
                {a.url && (
                  <a href={a.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-[#a78bfa]/70 hover:text-[#a78bfa] transition-colors truncate mt-0.5">
                    <LinkIcon size={9} /> {a.url}
                  </a>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => { setEditId(a.id); setIsNew(false); setForm({ name: a.name, url: a.url ?? '' }) }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <Pencil size={11} className="text-white/40" />
                </button>
                <button onClick={() => del(a.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/20"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <Trash2 size={11} className="text-white/40" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SettingsTab({ onMsg }: { onMsg: (msg: string, ok?: boolean) => void }) {
  const [settings, setSettings] = useState<Setting[]>([])
  const [features, setFeatures] = useState<Record<string, boolean>>({})
  const [loading, setLoading]   = useState(true)
  const [newKey, setNewKey]     = useState('')
  const [newVal, setNewVal]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data: Setting[] = await adminDb('select', 'settings', { order: 'key' })
      setSettings(data ?? [])
      const map: Record<string, boolean> = {}
      for (const f of FEATURE_FLAGS) {
        const row = (data ?? []).find((s: Setting) => s.key === f.key)
        // Par défaut activé si pas de valeur en base
        map[f.key] = row ? row.value !== 'false' : true
      }
      setFeatures(map)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function upsert(key: string, value: string) {
    await adminDb('upsert', 'settings', { key, value }, { col: 'key', val: key, onConflict: 'key' })
    onMsg('✅ Sauvegardé')
    load()
  }

  async function toggleFeature(key: string, val: boolean) {
    setFeatures(f => ({ ...f, [key]: val }))
    await adminDb('upsert', 'settings', { key, value: val ? 'true' : 'false' }, { col: 'key', val: key, onConflict: 'key' })
    onMsg(val ? `✅ ${FEATURE_FLAGS.find(f => f.key === key)?.label} activé` : `⛔ ${FEATURE_FLAGS.find(f => f.key === key)?.label} désactivé`)
  }

  async function add() {
    if (!newKey.trim()) return
    await upsert(newKey.trim(), newVal)
    setNewKey(''); setNewVal('')
  }

  return (
    <div className="space-y-8">
      {/* ── Fonctionnalités ── */}
      <div>
        <h3 className="text-sm font-bold text-white mb-1">Fonctionnalités</h3>
        <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Activer ou désactiver des modules du site en temps réel.
        </p>
        {loading ? <LoadingText /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURE_FLAGS.map(f => (
              <FeatureToggle
                key={f.key}
                featureKey={f.key}
                label={f.label}
                desc={f.desc}
                icon={f.icon}
                value={features[f.key] ?? true}
                onChange={toggleFeature}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Clés/valeurs brutes ── */}
      <div>
        <h3 className="text-sm font-bold text-white mb-1">Paramètres bruts</h3>
        <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Toutes les clés/valeurs de la table settings.</p>
        {loading ? <LoadingText /> : (
          <div className="space-y-2 mb-4">
            {settings.filter(s => !FEATURE_FLAGS.find(f => f.key === s.key)).map(s => (
              <div key={s.key} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-xs font-mono w-48 flex-shrink-0" style={{ color: '#a78bfa' }}>{s.key}</span>
                <input defaultValue={s.value}
                  onBlur={e => { if (e.target.value !== s.value) upsert(s.key, e.target.value) }}
                  className={`${inputCls} flex-1 text-xs`} />
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-3 items-end p-4 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Field label="Nouvelle clé">
            <input value={newKey} onChange={e => setNewKey(e.target.value)} className={inputCls} placeholder="ma_cle" />
          </Field>
          <Field label="Valeur">
            <input value={newVal} onChange={e => setNewVal(e.target.value)} className={inputCls} placeholder="valeur" />
          </Field>
          <button onClick={add} className={primaryBtnCls + ' flex-shrink-0'}>+ Ajouter</button>
        </div>
      </div>
    </div>
  )
}

// ─── Onglet SQL Editor ────────────────────────────────────────────────────────
function SqlTab({ onMsg }: { onMsg: (msg: string, ok?: boolean) => void }) {
  const [sql, setSql]       = useState('')
  const [result, setResult] = useState<unknown[] | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<string[]>([])

  async function run() {
    if (!sql.trim()) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/admin/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      })
      const json = await res.json()
      if (json.error) { setError(json.error); onMsg('Erreur SQL', false) }
      else {
        const rows = Array.isArray(json.data) ? json.data : json.data ? [json.data] : []
        setResult(rows)
        onMsg(`✅ ${rows.length} ligne(s) retournée(s)`)
        setHistory(h => [sql, ...h.filter(s => s !== sql)].slice(0, 10))
      }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(false) }
  }

  const cols = result && result.length > 0 ? Object.keys(result[0] as object) : []

  return (
    <div className="space-y-4">
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}
        >
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Cinzel, serif' }}>
            SQL Editor
          </span>
          <button
            onClick={run}
            disabled={loading}
            className="px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #7b2bff, #4a1fa8)', color: '#fff' }}
          >
            {loading ? '…' : '▶ Exécuter'}
          </button>
        </div>
        <textarea
          value={sql}
          onChange={e => setSql(e.target.value)}
          onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run() } }}
          className="w-full h-40 bg-transparent text-sm font-mono p-4 focus:outline-none resize-none"
          style={{ color: 'rgba(255,255,255,0.85)' }}
          placeholder="SELECT * FROM player_profiles LIMIT 10;"
          spellCheck={false}
        />
      </div>

      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Ctrl+Entrée pour exécuter · Service role (bypass RLS)</p>

      {history.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {history.map((h, i) => (
            <button
              key={i}
              onClick={() => setSql(h)}
              className="text-xs px-3 py-1 rounded-full font-mono truncate max-w-xs transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
            >
              {h.slice(0, 50)}{h.length > 50 ? '…' : ''}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl text-sm font-mono whitespace-pre-wrap" style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(127,29,29,0.15)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {result !== null && (
        <div>
          <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{result.length} ligne(s)</p>
          {result.length === 0 ? (
            <div className="p-4 rounded-2xl text-sm text-center" style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.3)' }}>
              Requête exécutée, aucune ligne retournée.
            </div>
          ) : (
            <div className="rounded-2xl overflow-auto max-h-[50vh]" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="sticky top-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,8,22,0.97)' }}>
                    {cols.map(c => (
                      <th key={c} className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Cinzel, serif' }}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }} className="transition-colors hover:bg-white/[0.03]">
                      {cols.map(c => {
                        const val = (row as Record<string, unknown>)[c]
                        const str = val === null ? 'null' : typeof val === 'object' ? JSON.stringify(val) : String(val)
                        return (
                          <td key={c} className="px-3 py-2 font-mono max-w-[200px] truncate" style={{ color: 'rgba(255,255,255,0.65)' }} title={str}>
                            {val === null ? <span style={{ color: 'rgba(255,255,255,0.2)' }}>null</span> : str}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Composants utilitaires ───────────────────────────────────────────────────
const inputCls = [
  'w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none text-white placeholder:text-white/30 transition-colors',
  'bg-white/[0.05] border border-white/[0.1] focus:border-[#7b2bff]/60',
].join(' ')

const selectCls = [
  'w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none text-white transition-colors',
  'bg-[#0a0816] border border-white/[0.1] focus:border-[#7b2bff]/60',
].join(' ')

const primaryBtnCls = [
  'px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 text-white',
  'bg-gradient-to-r from-[#7b2bff] to-[#4a1fa8]',
].join(' ')

const iconBtnCls = [
  'text-xs px-2.5 py-1.5 rounded-lg transition-colors text-white/60 hover:text-white',
  'bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08]',
].join(' ')

const dangerIconBtnCls = [
  'text-xs px-2.5 py-1.5 rounded-lg transition-colors text-red-400 hover:text-red-300',
  'bg-red-900/[0.15] hover:bg-red-900/[0.3] border border-red-900/[0.2]',
].join(' ')

function LoadingText() {
  return <p className="text-sm py-6" style={{ color: 'rgba(255,255,255,0.25)' }}>Chargement…</p>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Cinzel, serif' }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}
        style={{ background: '#0a0816', border: '1px solid rgba(123,43,255,0.3)', boxShadow: '0 0 60px rgba(123,43,255,0.15)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-base text-white" style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.05em' }}>
            {title}
          </h2>
          <button onClick={onClose} className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <X size={15} />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  )
}

function ModalActions({ onCancel, onConfirm, loading, label }: { onCancel: () => void; onConfirm: () => void; loading: boolean; label: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        onClick={onCancel}
        className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors hover:bg-white/5"
        style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}
      >
        Annuler
      </button>
      <button
        onClick={onConfirm}
        disabled={loading}
        className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #7b2bff, #4a1fa8)', color: '#fff' }}
      >
        {loading ? '…' : label}
      </button>
    </div>
  )
}
