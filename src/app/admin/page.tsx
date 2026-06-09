'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

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
}

interface Family {
  id?: string
  key: string
  label: string
  color: string
  description: string
  order_index?: number
}

interface Card {
  id?: string
  card_id: string
  name: string
  family: string
  rarity: string
  description: string
  art_url: string
  combat_atk: number
  combat_hp: number
  combat_cost: number
  combat_effects: string
}

interface Setting {
  key: string
  value: string
}

type Tab = 'players' | 'families' | 'cards' | 'boosters' | 'settings'

const BOOSTER_IMAGE_KEYS = [
  { key: 'booster_image_void',           label: 'VOID Pack' },
  { key: 'booster_image_harmony',        label: 'Harmony Pack' },
  { key: 'booster_image_pacific-bluffs', label: 'Pacific Bluffs Pack' },
  { key: 'booster_image_neon-divide',    label: 'Neon Divide Pack' },
  { key: 'booster_image_ash-district',   label: 'Ash District Pack' },
]

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'void']

// ─── Composant principal ──────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('players')
  const [msg, setMsg] = useState('')
  const [msgOk, setMsgOk] = useState(true)
  const sb = createClient()

  function showMsg(text: string, ok = true) {
    setMsg(text); setMsgOk(ok)
    setTimeout(() => setMsg(''), 4000)
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'players',  label: '👥 Joueurs' },
    { id: 'families', label: '🌐 Familles' },
    { id: 'cards',    label: '🃏 Cartes' },
    { id: 'boosters', label: '🎴 Boosters' },
    { id: 'settings', label: '⚙ Paramètres' },
  ]

  return (
    <div className="min-h-screen bg-[#030308] text-white">
      {/* Topbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
        <h1 className="text-lg font-bold">⬡ Admin VOID Pack</h1>
        <div className="flex items-center gap-3">
          {msg && (
            <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${msgOk ? 'bg-[#00c896]/15 text-[#00c896]' : 'bg-red-900/30 text-red-400'}`}>
              {msg}
            </span>
          )}
          <a href="/pack" className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors">
            ← Jeu
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-4 border-b border-white/8">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-colors ${
              tab === t.id
                ? 'bg-[#7b2bff]/15 border border-b-0 border-[#7b2bff]/30 text-white'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="p-6">
        {tab === 'players'  && <PlayersTab  sb={sb} onMsg={showMsg} />}
        {tab === 'families' && <FamiliesTab sb={sb} onMsg={showMsg} />}
        {tab === 'cards'    && <CardsTab    sb={sb} onMsg={showMsg} />}
        {tab === 'boosters' && <BoostersTab sb={sb} onMsg={showMsg} />}
        {tab === 'settings' && <SettingsTab sb={sb} onMsg={showMsg} />}
      </div>
    </div>
  )
}

// ─── Onglet Joueurs ───────────────────────────────────────────────────────────
function PlayersTab({ sb, onMsg }: { sb: ReturnType<typeof createClient>; onMsg: (msg: string, ok?: boolean) => void }) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [modal, setModal]     = useState<Player | null>(null)
  const [cType, setCType]     = useState('void')
  const [cQty, setCQty]       = useState(1)
  const [crediting, setCrediting] = useState(false)
  const [families, setFamilies] = useState<{ value: string; label: string }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await sb.from('player_profiles')
      .select('user_id,username,avatar_url,level,xp,packs_opened,current_streak,void_pulls,highest_rarity')
      .order('xp', { ascending: false }).limit(200)
    setPlayers(data ?? [])
    setLoading(false)
  }, [sb])

  useEffect(() => {
    load()
    sb.from('families').select('key,label').order('label').then(({ data }) => {
      setFamilies([
        { value: 'void', label: 'VOID Pack (global)' },
        ...(data ?? []).map((f: { key: string; label: string }) => ({ value: f.key, label: `${f.label} Pack` })),
      ])
    })
  }, [load, sb])

  async function credit() {
    if (!modal) return
    setCrediting(true)
    try {
      for (let i = 0; i < cQty; i++) {
        const { error } = await sb.rpc('credit_booster_to_user', { p_user_id: modal.user_id, p_booster_type: cType, p_source: 'admin' })
        if (error) throw error
      }
      onMsg(`✅ ${cQty}x "${cType}" → ${modal.username}`)
      setModal(null)
    } catch (e: unknown) { onMsg(e instanceof Error ? e.message : 'Erreur', false) }
    finally { setCrediting(false) }
  }

  const filtered = players.filter(p => !search || (p.username ?? '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-[#7b2bff]/60 focus:outline-none w-64" />
        <button onClick={load} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10">🔄</button>
        <span className="text-white/40 text-sm">{filtered.length} joueurs</span>
      </div>

      <div className="rounded-2xl border border-white/8 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/8 bg-white/3">
            {['Joueur','Niv','XP','Packs','Streak','VOID','Actions'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-white/50 text-xs uppercase tracking-wider font-semibold">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-white/30">Chargement…</td></tr>
            ) : filtered.map((p, i) => (
              <tr key={p.user_id} className={`border-b border-white/5 hover:bg-white/3 ${i%2===0?'':'bg-white/[0.02]'}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7b2bff] to-[#00c896] flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={p.avatar_url ? { backgroundImage: `url(${p.avatar_url})`, backgroundSize: 'cover' } : {}}>
                      {!p.avatar_url && (p.username?.[0]?.toUpperCase() ?? '?')}
                    </div>
                    <span>{p.username ?? '—'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#a78bfa]">{p.level}</td>
                <td className="px-4 py-3 text-white/70">{(p.xp ?? 0).toLocaleString('fr-FR')}</td>
                <td className="px-4 py-3 text-white/70">{p.packs_opened ?? 0}</td>
                <td className="px-4 py-3 text-white/70">{p.current_streak ?? 0}j</td>
                <td className="px-4 py-3 text-[#a855f7] font-bold">{p.void_pulls ?? 0}</td>
                <td className="px-4 py-3">
                  <button onClick={() => { setModal(p); setCType('void'); setCQty(1) }}
                    className="px-3 py-1.5 rounded-lg bg-[#7b2bff]/15 border border-[#7b2bff]/30 text-[#a78bfa] text-xs font-bold hover:bg-[#7b2bff]/30">
                    🎴 Créditer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title="🎴 Créditer un booster" onClose={() => setModal(null)}>
          <p className="text-sm text-white/50 mb-4">Joueur : <span className="text-white">{modal.username}</span></p>
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
    </div>
  )
}

// ─── Onglet Familles ──────────────────────────────────────────────────────────
function FamiliesTab({ sb, onMsg }: { sb: ReturnType<typeof createClient>; onMsg: (msg: string, ok?: boolean) => void }) {
  const [families, setFamilies] = useState<Family[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Family | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await sb.from('families').select('*').order('order_index')
    setFamilies(data ?? [])
    setLoading(false)
  }, [sb])

  useEffect(() => { load() }, [load])

  const empty: Family = { key: '', label: '', color: '#7b2bff', description: '' }

  async function save() {
    if (!form) return
    setSaving(true)
    try {
      if (form.id) {
        const { error } = await sb.from('families').update({ key: form.key, label: form.label, color: form.color, description: form.description }).eq('id', form.id)
        if (error) throw error
      } else {
        const { error } = await sb.from('families').insert({ key: form.key, label: form.label, color: form.color, description: form.description })
        if (error) throw error
      }
      onMsg(`✅ Famille "${form.label}" sauvegardée`)
      setForm(null)
      load()
    } catch (e: unknown) { onMsg(e instanceof Error ? e.message : 'Erreur', false) }
    finally { setSaving(false) }
  }

  async function del(fam: Family) {
    if (!confirm(`Supprimer "${fam.label}" ?`)) return
    await sb.from('families').delete().eq('id', fam.id!)
    onMsg(`🗑 "${fam.label}" supprimée`)
    load()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-white/40 text-sm">{families.length} famille(s)</p>
        <button onClick={() => setForm({ ...empty })}
          className="px-4 py-2 rounded-xl bg-[#7b2bff] text-white text-sm font-bold hover:opacity-90">
          + Nouvelle famille
        </button>
      </div>

      {loading ? <p className="text-white/30 text-sm">Chargement…</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {families.map(f => (
            <div key={f.id} className="p-4 rounded-2xl border border-white/8 bg-white/3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: f.color }} />
                <div>
                  <p className="font-semibold">{f.label}</p>
                  <p className="text-white/40 text-xs">{f.key}</p>
                  {f.description && <p className="text-white/50 text-xs mt-1 line-clamp-2">{f.description}</p>}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => setForm({ ...f })} className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10">✏</button>
                <button onClick={() => del(f)} className="text-xs px-2 py-1 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-400">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal title={form.id ? `Modifier "${form.label}"` : 'Nouvelle famille'} onClose={() => setForm(null)}>
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
          <ModalActions onCancel={() => setForm(null)} onConfirm={save} loading={saving} label={form.id ? 'Modifier' : 'Créer'} />
        </Modal>
      )}
    </div>
  )
}

// ─── Onglet Cartes ────────────────────────────────────────────────────────────
function CardsTab({ sb, onMsg }: { sb: ReturnType<typeof createClient>; onMsg: (msg: string, ok?: boolean) => void }) {
  const [cards, setCards]     = useState<Card[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState<Card | null>(null)
  const [saving, setSaving]   = useState(false)
  const [search, setSearch]   = useState('')
  const [filterFam, setFilterFam] = useState('')

  const empty: Card = { card_id: '', name: '', family: '', rarity: 'common', description: '', art_url: '', combat_atk: 1, combat_hp: 2, combat_cost: 1, combat_effects: '' }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await sb.from('custom_cards').select('*').order('name')
    setCards(data ?? [])
    setLoading(false)
  }, [sb])

  useEffect(() => {
    load()
    sb.from('families').select('*').order('label').then(({ data }) => setFamilies(data ?? []))
  }, [load, sb])

  async function save() {
    if (!form) return
    setSaving(true)
    try {
      const payload = {
        card_id: form.card_id || form.name.toLowerCase().replace(/\s+/g, '-'),
        name: form.name, family: form.family, rarity: form.rarity,
        description: form.description, art_url: form.art_url,
        metadata: { combat: { atk: form.combat_atk, hp: form.combat_hp, cost: form.combat_cost, effects: form.combat_effects.split(',').map(e => e.trim()).filter(Boolean) } }
      }
      if (form.id) {
        const { error } = await sb.from('custom_cards').update(payload).eq('id', form.id)
        if (error) throw error
      } else {
        const { error } = await sb.from('custom_cards').insert(payload)
        if (error) throw error
      }
      onMsg(`✅ Carte "${form.name}" sauvegardée`)
      setForm(null); load()
    } catch (e: unknown) { onMsg(e instanceof Error ? e.message : 'Erreur', false) }
    finally { setSaving(false) }
  }

  async function del(card: Card) {
    if (!confirm(`Supprimer "${card.name}" ?`)) return
    await sb.from('custom_cards').delete().eq('id', card.id!)
    onMsg(`🗑 "${card.name}" supprimée`); load()
  }

  const RARITY_COLOR: Record<string, string> = { void: '#7b2bff', legendary: '#f59e0b', epic: '#a855f7', rare: '#3b82f6', uncommon: '#22c55e', common: '#9ca3af' }

  const filtered = cards.filter(c =>
    (!search || c.name.toLowerCase().includes(search.toLowerCase())) &&
    (!filterFam || c.family === filterFam)
  )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une carte…" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-[#7b2bff]/60 focus:outline-none w-56" />
        <select value={filterFam} onChange={e => setFilterFam(e.target.value)} className={`${selectCls} w-44`}>
          <option value="">Toutes les familles</option>
          {families.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <span className="text-white/40 text-sm">{filtered.length} carte(s)</span>
        <button onClick={() => setForm({ ...empty })}
          className="ml-auto px-4 py-2 rounded-xl bg-[#7b2bff] text-white text-sm font-bold hover:opacity-90">
          + Nouvelle carte
        </button>
      </div>

      {loading ? <p className="text-white/30 text-sm">Chargement…</p> : (
        <div className="rounded-2xl border border-white/8 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/8 bg-white/3">
              {['Carte','Famille','Rareté','ATK','HP','Coût','Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-white/50 text-xs uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-white/30">Aucune carte.</td></tr>
              ) : filtered.map((c, i) => (
                <tr key={c.id} className={`border-b border-white/5 hover:bg-white/3 ${i%2===0?'':'bg-white/[0.02]'}`}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-white/60">{c.family || '—'}</td>
                  <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: RARITY_COLOR[c.rarity], background: RARITY_COLOR[c.rarity] + '20' }}>{c.rarity}</span></td>
                  <td className="px-4 py-3 text-white/70">{(c as unknown as { metadata?: { combat?: { atk?: number } } }).metadata?.combat?.atk ?? '—'}</td>
                  <td className="px-4 py-3 text-white/70">{(c as unknown as { metadata?: { combat?: { hp?: number } } }).metadata?.combat?.hp ?? '—'}</td>
                  <td className="px-4 py-3 text-white/70">{(c as unknown as { metadata?: { combat?: { cost?: number } } }).metadata?.combat?.cost ?? '—'}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => setForm({ ...c, combat_atk: (c as unknown as { metadata?: { combat?: { atk?: number } } }).metadata?.combat?.atk ?? 1, combat_hp: (c as unknown as { metadata?: { combat?: { hp?: number } } }).metadata?.combat?.hp ?? 2, combat_cost: (c as unknown as { metadata?: { combat?: { cost?: number } } }).metadata?.combat?.cost ?? 1, combat_effects: ((c as unknown as { metadata?: { combat?: { effects?: string[] } } }).metadata?.combat?.effects ?? []).join(', ') })}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs">✏</button>
                    <button onClick={() => del(c)} className="px-2 py-1 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-400 text-xs">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal title={form.id ? `Modifier "${form.name}"` : 'Nouvelle carte'} onClose={() => setForm(null)} wide>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom"><input value={form.name} onChange={e => setForm(f => f && ({ ...f, name: e.target.value }))} className={inputCls} /></Field>
            <Field label="Clé (auto si vide)"><input value={form.card_id} onChange={e => setForm(f => f && ({ ...f, card_id: e.target.value }))} className={inputCls} placeholder="auto" /></Field>
            <Field label="Famille">
              <select value={form.family} onChange={e => setForm(f => f && ({ ...f, family: e.target.value }))} className={selectCls}>
                <option value="">— Aucune —</option>
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
            <Field label="Effets (taunt, shield, charge…)"><input value={form.combat_effects} onChange={e => setForm(f => f && ({ ...f, combat_effects: e.target.value }))} className={inputCls} placeholder="taunt, shield" /></Field>
            <div className="col-span-2">
              <Field label="URL artwork"><input value={form.art_url} onChange={e => setForm(f => f && ({ ...f, art_url: e.target.value }))} className={inputCls} placeholder="https://…" /></Field>
            </div>
            <div className="col-span-2">
              <Field label="Description">
                <textarea value={form.description} onChange={e => setForm(f => f && ({ ...f, description: e.target.value }))} className={`${inputCls} resize-none h-20`} />
              </Field>
            </div>
          </div>
          <ModalActions onCancel={() => setForm(null)} onConfirm={save} loading={saving} label={form.id ? 'Modifier' : 'Créer'} />
        </Modal>
      )}
    </div>
  )
}

// ─── Onglet Boosters ──────────────────────────────────────────────────────────
function BoostersTab({ sb, onMsg }: { sb: ReturnType<typeof createClient>; onMsg: (msg: string, ok?: boolean) => void }) {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [families, setFamilies] = useState<Family[]>([])

  useEffect(() => {
    sb.from('settings').select('key,value').then(({ data }) => {
      const map: Record<string, string> = {}
      ;(data ?? []).forEach((s: Setting) => { map[s.key] = s.value })
      setSettings(map)
      setLoading(false)
    })
    sb.from('families').select('key,label').order('label').then(({ data }) => setFamilies(data ?? []))
  }, [sb])

  async function save(key: string, value: string) {
    setSaving(true)
    await sb.from('settings').upsert({ key, value }, { onConflict: 'key' })
    setSettings(s => ({ ...s, [key]: value }))
    setSaving(false)
    onMsg('✅ Image sauvegardée')
  }

  const allKeys = [
    { key: 'booster_image_void',  label: 'VOID Pack' },
    { key: 'booster_image_dos',   label: 'Dos de carte (global)' },
    ...(families.map(f => ({ key: `booster_image_${f.key}`, label: `${f.label} Pack` }))),
  ]

  return (
    <div>
      <p className="text-white/50 text-sm mb-6">Configure les images des boosters. Colle une URL d'image publique (Imgur, CDN, Supabase Storage…)</p>
      {loading ? <p className="text-white/30 text-sm">Chargement…</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {allKeys.map(({ key, label }) => (
            <div key={key} className="p-4 rounded-2xl border border-white/8 bg-white/3">
              <p className="text-sm font-semibold mb-2">{label}</p>
              <div className="flex gap-2">
                <input
                  defaultValue={settings[key] ?? ''}
                  onBlur={e => { if (e.target.value !== settings[key]) save(key, e.target.value) }}
                  placeholder="https://…"
                  className={`${inputCls} flex-1 text-xs`}
                />
              </div>
              {settings[key] && (
                <img src={settings[key]} alt="" className="mt-3 h-24 rounded-xl object-cover w-full border border-white/10" />
              )}
            </div>
          ))}
        </div>
      )}
      {saving && <p className="text-[#00c896] text-xs mt-3">Sauvegarde…</p>}
    </div>
  )
}

// ─── Onglet Paramètres ────────────────────────────────────────────────────────
function SettingsTab({ sb, onMsg }: { sb: ReturnType<typeof createClient>; onMsg: (msg: string, ok?: boolean) => void }) {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading]   = useState(true)
  const [newKey, setNewKey]     = useState('')
  const [newVal, setNewVal]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await sb.from('settings').select('*').order('key')
    setSettings(data ?? [])
    setLoading(false)
  }, [sb])

  useEffect(() => { load() }, [load])

  async function upsert(key: string, value: string) {
    await sb.from('settings').upsert({ key, value }, { onConflict: 'key' })
    onMsg('✅ Sauvegardé')
    load()
  }

  async function add() {
    if (!newKey.trim()) return
    await upsert(newKey.trim(), newVal)
    setNewKey(''); setNewVal('')
  }

  return (
    <div>
      <p className="text-white/50 text-sm mb-6">Paramètres globaux du jeu — clé/valeur.</p>
      {loading ? <p className="text-white/30 text-sm">Chargement…</p> : (
        <div className="space-y-2 mb-6">
          {settings.map(s => (
            <div key={s.key} className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/3">
              <span className="text-xs font-mono text-[#a78bfa] w-48 flex-shrink-0">{s.key}</span>
              <input defaultValue={s.value}
                onBlur={e => { if (e.target.value !== s.value) upsert(s.key, e.target.value) }}
                className={`${inputCls} flex-1 text-xs`} />
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-3 items-end p-4 rounded-2xl border border-white/8 bg-white/3">
        <Field label="Nouvelle clé"><input value={newKey} onChange={e => setNewKey(e.target.value)} className={inputCls} placeholder="ma_cle" /></Field>
        <Field label="Valeur"><input value={newVal} onChange={e => setNewVal(e.target.value)} className={inputCls} placeholder="valeur" /></Field>
        <button onClick={add} className="px-4 py-2.5 rounded-xl bg-[#7b2bff] text-white text-sm font-bold hover:opacity-90 flex-shrink-0">+ Ajouter</button>
      </div>
    </div>
  )
}

// ─── Composants utilitaires ───────────────────────────────────────────────────
const inputCls  = 'w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-[#7b2bff]/60 focus:outline-none'
const selectCls = 'w-full px-3 py-2.5 rounded-xl bg-[#0a0816] border border-white/10 text-sm focus:border-[#7b2bff]/60 focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <span className="text-xs font-bold uppercase tracking-wider text-white/40">{label}</span>
      {children}
    </div>
  )
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`bg-[#0a0816] border border-[#7b2bff]/30 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto ${wide ? 'w-full max-w-2xl' : 'w-full max-w-md'}`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-base">{title}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  )
}

function ModalActions({ onCancel, onConfirm, loading, label }: { onCancel: () => void; onConfirm: () => void; loading: boolean; label: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-white/15 text-white/60 text-sm font-bold hover:bg-white/5">Annuler</button>
      <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#7b2bff] to-[#4a1fa8] text-white text-sm font-bold disabled:opacity-50 hover:opacity-90">
        {loading ? '…' : label}
      </button>
    </div>
  )
}
