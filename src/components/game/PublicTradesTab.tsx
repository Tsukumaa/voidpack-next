'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeftRight, Plus, Search, X, Clock, Globe } from 'lucide-react'
import { useGameStore } from '@/store/game'
import { useCards } from '@/hooks/useCards'
import { isPromoCard } from '@/components/game/PromoCardsShowcase'
import { cn } from '@/lib/utils'

// ── Trades publics : "j'offre X contre Y", ouvert à tous les joueurs ─────────
// (les trades privés, d'un joueur à un ami, restent dans l'onglet "Privés")

const RARITY_COLOR: Record<string, string> = { void: '#a855f7', legendary: '#ff9a3d', epic: '#ec4899', rare: '#4aa3ff', uncommon: '#22c55e', common: '#9ca3af' }
const RARITY_LABEL: Record<string, string> = { void: 'Void', legendary: 'Légendaire', epic: 'Épique', rare: 'Rare', uncommon: 'Peu commune', common: 'Commune' }
const RARITY_ORDER = ['void', 'legendary', 'epic', 'rare', 'uncommon', 'common']

interface CardDef { id: string; name: string; rarity: string; image_url: string | null; exclusive?: boolean | number }

interface PublicTrade {
  id: string
  sellerId: string
  sellerUsername?: string
  sellerAvatarUrl?: string | null
  offeredCardKey: string
  offeredRarity: string
  wantedCardKey: string
  wantedRarity: string | null
  message: string | null
  createdAt: string
  expiresAt: string | null
}

function Thumb({ def, rarity }: { def?: CardDef; rarity: string }) {
  const color = RARITY_COLOR[rarity] ?? '#9ca3af'
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-9 h-12 rounded-md shrink-0 overflow-hidden border bg-[#0a0816]" style={{ borderColor: color + '70' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {def?.image_url ? <img src={def.image_url} alt="" className="w-full h-full object-cover" /> : null}
      </div>
      <div className="min-w-0">
        <p className="text-white text-xs font-bold truncate uppercase">{def?.name ?? '?'}</p>
        <p className="text-[10px] font-bold" style={{ color }}>{RARITY_LABEL[rarity] ?? rarity}</p>
      </div>
    </div>
  )
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

export function PublicTradesTab() {
  const user = useGameStore(s => s.user)
  const { fetchCards } = useCards()
  const [defs, setDefs]       = useState<Record<string, CardDef>>({})
  const [browse, setBrowse]   = useState<PublicTrade[]>([])
  const [mine, setMine]       = useState<PublicTrade[]>([])
  const [owned, setOwned]     = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<string | null>(null)
  const [msg, setMsg]         = useState<{ text: string; ok: boolean } | null>(null)
  const [search, setSearch]   = useState('')
  const [onlyMatching, setOnlyMatching] = useState(false) // seulement les trades que je peux accepter
  const [showCreate, setShowCreate] = useState(false)

  const flash = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3500) }

  const load = useCallback(async () => {
    if (!user) return
    const [data, cards, col] = await Promise.all([
      fetch('/api/trade/public').then(r => r.ok ? r.json() : null),
      fetchCards(),
      fetch('/api/collection').then(r => r.ok ? r.json() : []),
    ])
    const m: Record<string, CardDef> = {}
    for (const c of cards ?? []) m[c.id] = { id: c.id, name: c.name, rarity: c.rarity, image_url: c.imageUrl ?? c.image_url ?? null, exclusive: c.exclusive }
    setDefs(m)
    setOwned(Object.fromEntries((col ?? []).map((c: { cardId?: string; card_id?: string; count: number }) => [c.cardId ?? c.card_id ?? '', c.count])))
    if (data) { setBrowse(data.browse ?? []); setMine(data.mine ?? []) }
    setLoading(false)
  }, [user, fetchCards])

  useEffect(() => { load() }, [load])

  async function act(t: PublicTrade, action: 'accept' | 'cancel') {
    setBusy(t.id)
    try {
      const res = await fetch(`/api/trade/public/${t.id}/${action}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { flash(data.error ?? 'Erreur', false); load(); return }
      flash(action === 'accept'
        ? `Échange effectué : ${defs[t.offeredCardKey]?.name ?? 'la carte'} est dans ta collection !`
        : 'Trade retiré.')
      load()
    } finally { setBusy(null) }
  }

  // Mes trades en premier, puis ceux des autres (filtrés)
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const match = (t: PublicTrade) => !q
      || (defs[t.offeredCardKey]?.name ?? '').toLowerCase().includes(q)
      || (defs[t.wantedCardKey]?.name ?? '').toLowerCase().includes(q)
      || (t.sellerUsername ?? '').toLowerCase().includes(q)
    return [
      ...mine.filter(match),
      ...browse.filter(t => match(t) && (!onlyMatching || (owned[t.wantedCardKey] ?? 0) > 0)),
    ]
  }, [mine, browse, defs, owned, search, onlyMatching])

  if (!user) return <p className="text-white/30 text-sm text-center py-10">Connecte-toi pour voir les trades publics.</p>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-3">
        <Globe size={18} className="text-[#a78bfa] shrink-0" />
        <p className="flex-1 text-white/50 text-[11px]">Propose une carte contre une autre : <strong className="text-white/70">n’importe quel joueur</strong> peut accepter. L’échange se fait aussitôt.</p>
        <button onClick={() => setShowCreate(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-bold"
          style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
          <Plus size={13} /> Publier
        </button>
      </div>

      {msg && (
        <div className={cn('px-4 py-2.5 rounded-xl text-sm text-center border', msg.ok ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-300')}>
          {msg.text}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Carte ou joueur…"
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[#7b2bff]/60" />
        </div>
        <button onClick={() => setOnlyMatching(v => !v)}
          className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-colors',
            onlyMatching ? 'bg-[#7b2bff]/25 border-[#7b2bff]/50 text-[#c4b5fd]' : 'bg-white/5 border-white/10 text-white/50')}>
          Ceux que je peux accepter
        </button>
      </div>

      {loading ? <p className="text-white/30 text-sm text-center py-10">Chargement…</p> : visible.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-10">
          {browse.length + mine.length === 0 ? 'Aucun trade public pour l’instant. Publie le premier !' : 'Aucun trade ne correspond.'}
        </p>
      ) : (
        // Deux colonnes dès la tablette : chaque trade reste compact (pas de grand vide au milieu)
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map(t => {
            const isMine = t.sellerId === user.id
            const haveWanted = (owned[t.wantedCardKey] ?? 0) > 0
            return (
              <div key={t.id} className={cn('rounded-2xl border backdrop-blur-sm p-3 flex flex-col gap-2.5',
                isMine ? 'border-[#7b2bff]/40 bg-[#7b2bff]/[0.06]' : 'border-white/[0.06] bg-white/[0.03]')}>
                <div className="flex items-center gap-2 text-[11px]">
                  {isMine
                    ? <span className="px-1.5 py-0.5 rounded-md bg-[#7b2bff]/30 text-[#c4b5fd] font-bold">Ton trade</span>
                    : <span className="text-white/50 truncate">Proposé par <span className="text-white font-bold">{t.sellerUsername}</span></span>}
                  <span className="ml-auto shrink-0 flex items-center gap-1 text-white/30"><Clock size={10} />{t.expiresAt ? `expire le ${formatDate(t.expiresAt)}` : formatDate(t.createdAt)}</span>
                </div>

                {/* Les deux cartes, côte à côte de part et d'autre de la flèche */}
                <div className="flex items-stretch gap-2">
                  <div className="flex-1 min-w-0 rounded-xl bg-black/20 border border-white/[0.05] p-2">
                    <p className="text-white/30 text-[10px] mb-1">{isMine ? 'Tu offres' : 'Tu reçois'}</p>
                    <Thumb def={defs[t.offeredCardKey]} rarity={t.offeredRarity} />
                  </div>
                  <div className="flex items-center shrink-0"><ArrowLeftRight size={15} className="text-white/30" /></div>
                  <div className="flex-1 min-w-0 rounded-xl bg-black/20 border border-white/[0.05] p-2">
                    <p className="text-white/30 text-[10px] mb-1">{isMine ? 'Tu demandes' : 'Tu donnes'}</p>
                    <Thumb def={defs[t.wantedCardKey]} rarity={t.wantedRarity ?? 'common'} />
                    {!isMine && (
                      <p className={cn('text-[10px] mt-1', haveWanted ? 'text-white/40' : 'text-red-400/70')}>
                        {haveWanted ? `tu en as ${owned[t.wantedCardKey]}` : 'tu ne l’as pas'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Message à gauche, action à droite */}
                <div className="flex items-center gap-3 mt-auto">
                  <p className="flex-1 min-w-0 text-white/40 text-xs italic truncate">{t.message ? `« ${t.message} »` : ''}</p>
                  {isMine ? (
                    <button onClick={() => act(t, 'cancel')} disabled={busy === t.id}
                      className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-bold hover:bg-white/10 disabled:opacity-50">
                      {busy === t.id ? '…' : 'Retirer'}
                    </button>
                  ) : (
                    <button onClick={() => act(t, 'accept')} disabled={!haveWanted || busy === t.id}
                      className={cn('px-3 py-1.5 rounded-xl text-xs font-bold', haveWanted ? 'text-white disabled:opacity-50' : 'bg-white/5 text-white/30 cursor-not-allowed')}
                      style={haveWanted ? { background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' } : undefined}>
                      {busy === t.id ? '…' : 'Accepter l’échange'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreatePublicTradeModal defs={defs} owned={owned}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); flash('Trade publié !'); load() }} />
      )}
    </div>
  )
}

// Publication : carte offerte (ma collection) → carte demandée (toutes) → confirmation
function CreatePublicTradeModal({ defs, owned, onClose, onCreated }: {
  defs: Record<string, CardDef>; owned: Record<string, number>
  onClose: () => void; onCreated: () => void
}) {
  const [step, setStep]       = useState<'offer' | 'want' | 'confirm'>('offer')
  const [search, setSearch]   = useState('')
  const [offered, setOffered] = useState<CardDef | null>(null)
  const [wanted, setWanted]   = useState<CardDef | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const q = search.trim().toLowerCase()
  const byRarity = (a: CardDef, b: CardDef) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name)
  // Cartes promo exclues des deux côtés
  const offerList = Object.entries(owned)
    .filter(([id, n]) => n > 0 && defs[id] && !isPromoCard(defs[id]) && defs[id].name.toLowerCase().includes(q))
    .map(([id]) => defs[id]).sort(byRarity)
  const wantList = Object.values(defs)
    .filter(d => !isPromoCard(d) && d.id !== offered?.id && d.name.toLowerCase().includes(q)).sort(byRarity)

  async function submit() {
    if (!offered || !wanted) return
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/trade/public', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offeredCardKey: offered.id, wantedCardKey: wanted.id, message: message || null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erreur'); return }
      onCreated()
    } catch { setError('Erreur réseau') } finally { setSaving(false) }
  }

  const steps = [['offer', 'Ta carte à offrir'], ['want', 'La carte que tu veux'], ['confirm', 'Confirmer']] as const
  const stepIdx = steps.findIndex(s => s[0] === step)

  const list = step === 'offer' ? offerList : wantList
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full sm:w-[480px] h-[min(620px,90vh)] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#0a0612] border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/[0.06] shrink-0">
          <h3 className="text-white font-black flex items-center gap-2"><Globe size={16} /> Trade public</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>
        <div className="flex items-center gap-1 px-5 py-3 shrink-0">
          {steps.map(([s], i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={cn('w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center',
                i === stepIdx ? 'bg-[#7b2bff] text-white' : i < stepIdx ? 'bg-[#7b2bff]/40 text-white/60' : 'bg-white/5 text-white/30')}>{i + 1}</div>
              {i < steps.length - 1 && <div className="w-6 h-px bg-white/10" />}
            </div>
          ))}
          <span className="ml-2 text-xs text-white/40">{steps[stepIdx][1]}</span>
        </div>

        {step !== 'confirm' ? (
          <div className="flex-1 min-h-0 flex flex-col px-4 pb-4 gap-3">
            <div className="relative shrink-0">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une carte…"
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[#7b2bff]/60" />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
              {list.length === 0 && <p className="text-center text-white/30 text-sm py-8">Aucune carte</p>}
              {list.slice(0, 80).map(d => (
                <button key={d.id}
                  onClick={() => { setSearch(''); if (step === 'offer') { setOffered(d); setStep('want') } else { setWanted(d); setStep('confirm') } }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-white/[0.06] hover:border-white/20 hover:bg-white/[0.03] text-left">
                  <Thumb def={d} rarity={d.rarity} />
                  <span className="text-xs text-white/30 shrink-0">
                    {step === 'offer' ? `x${owned[d.id]}` : (owned[d.id] ?? 0) > 0 ? `tu en as ${owned[d.id]}` : 'non possédée'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : offered && wanted && (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-4">
            <div className="rounded-2xl border border-white/[0.06] p-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div><p className="text-white/40 text-xs mb-1.5">Tu offres</p><Thumb def={offered} rarity={offered.rarity} /></div>
              <ArrowLeftRight size={16} className="text-white/25" />
              <div><p className="text-white/40 text-xs mb-1.5">Tu veux</p><Thumb def={wanted} rarity={wanted.rarity} /></div>
            </div>
            <p className="text-white/40 text-xs">Visible par tous les joueurs pendant 7 jours. Le premier qui accepte reçoit ta carte et te donne la sienne.</p>
            <div>
              <label className="text-white/40 text-xs block mb-1.5">Message (optionnel)</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Un petit mot…" rows={2} maxLength={200}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[#7b2bff]/60 resize-none" />
            </div>
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          </div>
        )}

        <div className="flex gap-3 px-5 py-4 border-t border-white/[0.06] shrink-0">
          {step !== 'offer' && (
            <button onClick={() => { setSearch(''); setStep(step === 'confirm' ? 'want' : 'offer') }}
              className="px-4 py-2.5 rounded-xl border border-white/15 text-white/60 text-sm font-bold hover:bg-white/5">Retour</button>
          )}
          {step === 'confirm' && (
            <button onClick={submit} disabled={saving} className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
              {saving ? 'Publication…' : 'Publier le trade'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
