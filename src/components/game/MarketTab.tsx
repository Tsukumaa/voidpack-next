'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Flame, Plus, Search, X, Clock, Tag, ShoppingCart } from 'lucide-react'
import { useGameStore } from '@/store/game'
import { useCards } from '@/hooks/useCards'
import { CardHover } from '@/components/game/CardHover'
import { CardFrame } from '@/components/game/CardFrame'
import { CardMedia } from '@/components/game/CardMedia'
import { isPromoCard } from '@/components/game/PromoCardsShowcase'
import { MANA_PER_RARITY } from '@/lib/game/mana-constants'
import { cn } from '@/lib/utils'

// ── Marché : achat et vente de cartes contre du mana ─────────────────────────
// Règles côté serveur (lib/game/market.ts) : carte mise de côté pendant la vente,
// commission de 10 % pour le vendeur, prix plancher = valeur de recyclage, 7 jours.

const RARITY_ORDER = ['void', 'legendary', 'epic', 'rare', 'common']
const RARITY_LABEL: Record<string, string> = { void: 'Void', legendary: 'Légendaire', epic: 'Épique', rare: 'Rare', common: 'Commune' }
const RARITY_COLOR: Record<string, string> = { void: '#a855f7', legendary: '#ff9a3d', epic: '#ec4899', rare: '#4aa3ff', common: '#9ca3af' }

const fmt = (n: number) => n.toLocaleString('fr-FR')
const minPrice = (rarity: string) => Math.max(1, MANA_PER_RARITY[rarity] ?? 1)

interface Listing {
  id: string
  sellerId: string
  cardId: string
  rarity: string
  price: number
  createdAt: string
  expiresAt: string
  closedAt?: string | null
  sellerGain?: number | null
  sellerUsername?: string
  buyerUsername?: string
}

interface CardDef { id: string; name: string; rarity: string; image_url: string | null; exclusive?: boolean | number }

function ManaChip({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 font-black tabular-nums text-[#c4b5fd]', className)}>
      <Flame size={12} className="text-[#a78bfa]" />{fmt(value)}
    </span>
  )
}

function CardArt({ def, rarity }: { def?: CardDef; rarity: string }) {
  return (
    <CardHover rarity={rarity} className="relative" style={{ aspectRatio: '0.714' }}>
      <CardFrame rarity={rarity} name={def?.name} glow={false} hideStats style={{ position: 'absolute', inset: 0 }}>
        {def?.image_url ? <CardMedia src={def.image_url} alt={def.name} /> : <div className="w-full h-full bg-black" />}
      </CardFrame>
    </CardHover>
  )
}

export function MarketTab() {
  const { user, profile, setProfile } = useGameStore(s => ({ user: s.user, profile: s.profile, setProfile: s.setProfile }))
  const { fetchCards } = useCards()

  const [tab, setTab]           = useState<'browse' | 'mine'>('browse')
  const [defs, setDefs]         = useState<Record<string, CardDef>>({})
  const [browse, setBrowse]     = useState<Listing[]>([])
  const [mine, setMine]         = useState<Listing[]>([])
  const [sold, setSold]         = useState<Listing[]>([])
  const [owned, setOwned]       = useState<Record<string, number>>({})
  const [mana, setMana]         = useState(0)
  const [commission, setCommission] = useState(0.1)
  const [loading, setLoading]   = useState(true)
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null)
  const [busy, setBusy]         = useState<string | null>(null)
  const [confirmBuy, setConfirmBuy] = useState<Listing | null>(null)
  const [showSell, setShowSell] = useState(false)

  // Filtres de la liste
  const [search, setSearch]     = useState('')
  const [rarity, setRarity]     = useState<string>('all')
  const [sort, setSort]         = useState<'recent' | 'price_asc' | 'price_desc'>('recent')

  const flash = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3500) }

  const load = useCallback(async () => {
    if (!user) return
    const [data, cards, col] = await Promise.all([
      fetch('/api/market').then(r => r.ok ? r.json() : null),
      fetchCards(),
      fetch('/api/collection').then(r => r.ok ? r.json() : []),
    ])
    const m: Record<string, CardDef> = {}
    for (const c of cards ?? []) m[c.id] = { id: c.id, name: c.name, rarity: c.rarity, image_url: c.imageUrl ?? c.image_url ?? null, exclusive: c.exclusive }
    setDefs(m)
    setOwned(Object.fromEntries((col ?? []).map((c: { cardId?: string; card_id?: string; count: number }) => [c.cardId ?? c.card_id ?? '', c.count])))
    if (data) {
      setBrowse(data.browse ?? []); setMine(data.mine ?? []); setSold(data.sold ?? [])
      setMana(data.mana ?? 0); setCommission(data.commission ?? 0.1)
    }
    setLoading(false)
  }, [user, fetchCards])

  useEffect(() => { load() }, [load])

  const syncMana = (value: number) => {
    setMana(value)
    if (profile) setProfile({ ...profile, mana: value })
  }

  async function buy(l: Listing) {
    setBusy(l.id)
    try {
      const res = await fetch(`/api/market/${l.id}/buy`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { flash(data.error ?? 'Erreur', false); load(); return }
      syncMana(data.manaRemaining)
      flash(`${defs[l.cardId]?.name ?? 'Carte'} ajoutée à ta collection !`)
      setConfirmBuy(null)
      load()
    } finally { setBusy(null) }
  }

  async function cancel(l: Listing) {
    setBusy(l.id)
    try {
      const res = await fetch(`/api/market/${l.id}/cancel`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { flash(data.error ?? 'Erreur', false); return }
      flash('Vente retirée : la carte est revenue dans ta collection.')
      load()
    } finally { setBusy(null) }
  }

  // "À vendre" montre tout le marché, y compris mes propres ventes (marquées "Ta vente")
  const allListings = useMemo(() => [
    ...browse,
    ...mine.map(l => ({ ...l, sellerUsername: 'toi' })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [browse, mine])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = allListings.filter(l => {
      const def = defs[l.cardId]
      if (!def) return false
      if (rarity !== 'all' && l.rarity !== rarity) return false
      return !q || def.name.toLowerCase().includes(q) || (l.sellerUsername ?? '').toLowerCase().includes(q)
    })
    if (sort === 'price_asc') list.sort((a, b) => a.price - b.price)
    else if (sort === 'price_desc') list.sort((a, b) => b.price - a.price)
    return list
  }, [allListings, defs, search, rarity, sort])

  if (!user) return <p className="text-white/30 text-sm text-center py-10">Connecte-toi pour voir le marché.</p>

  return (
    <div className="space-y-4">
      {/* En-tête : mana + vendre */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-3">
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">Marché</p>
          <p className="text-white/40 text-[11px]">Achète et vends des cartes contre du mana · commission de {Math.round(commission * 100)} % sur les ventes</p>
        </div>
        <div className="shrink-0 px-2.5 py-1.5 rounded-xl text-xs" style={{ background: 'rgba(123,43,255,0.12)', border: '1px solid rgba(123,43,255,0.25)' }}>
          <ManaChip value={mana} />
        </div>
        <button onClick={() => setShowSell(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-bold"
          style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
          <Plus size={13} /> Vendre
        </button>
      </div>

      {msg && (
        <div className={cn('px-4 py-2.5 rounded-xl text-sm text-center border', msg.ok ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-300')}>
          {msg.text}
        </div>
      )}

      {/* Onglets */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.06]">
        {([['browse', `À vendre (${allListings.length})`], ['mine', `Mes ventes (${mine.length})`]] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold transition-all', tab === t ? 'bg-[#7b2bff] text-white' : 'text-white/40 hover:text-white/60')}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-white/30 text-sm text-center py-10">Chargement…</p> : tab === 'browse' ? (
        <>
          {/* Filtres */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Carte ou vendeur…"
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[#7b2bff]/60" />
            </div>
            <select value={rarity} onChange={e => setRarity(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#0a0816] border border-white/10 text-sm text-white focus:outline-none">
              <option value="all">Toutes raretés</option>
              {RARITY_ORDER.map(r => <option key={r} value={r}>{RARITY_LABEL[r]}</option>)}
            </select>
            <select value={sort} onChange={e => setSort(e.target.value as typeof sort)}
              className="px-3 py-2 rounded-xl bg-[#0a0816] border border-white/10 text-sm text-white focus:outline-none">
              <option value="recent">Plus récentes</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
            </select>
          </div>

          {visible.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-10">
              {allListings.length === 0 ? 'Aucune carte en vente pour l’instant. Sois le premier à vendre !' : 'Aucune carte ne correspond à ta recherche.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {visible.map(l => {
                const def = defs[l.cardId]
                const affordable = mana >= l.price
                const isMine = l.sellerId === user.id
                return (
                  <div key={l.id} className={cn('rounded-2xl border backdrop-blur-sm p-2.5 flex flex-col gap-2',
                    isMine ? 'border-[#7b2bff]/40 bg-[#7b2bff]/[0.06]' : 'border-white/[0.06] bg-white/[0.03]')}>
                    <CardArt def={def} rarity={l.rarity} />
                    {isMine ? (
                      <>
                        <div className="flex items-center justify-between gap-1 text-[10px]">
                          <span className="px-1.5 py-0.5 rounded-md bg-[#7b2bff]/30 text-[#c4b5fd] font-bold">Ta vente</span>
                          <ManaChip value={l.price} className="text-[11px]" />
                        </div>
                        <button onClick={() => cancel(l)} disabled={busy === l.id}
                          className="w-full py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-bold hover:bg-white/10 disabled:opacity-50">
                          {busy === l.id ? '…' : 'Retirer'}
                        </button>
                      </>
                    ) : <>
                    <div className="flex items-center justify-between gap-1 text-[10px]">
                      <span className="text-white/40 truncate">par {l.sellerUsername}</span>
                      <span className="text-white/30 shrink-0">{owned[l.cardId] ? `tu en as ${owned[l.cardId]}` : 'nouvelle !'}</span>
                    </div>
                    <button onClick={() => setConfirmBuy(l)} disabled={!affordable || busy === l.id}
                      className={cn('w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-black transition-opacity',
                        affordable ? 'text-white hover:opacity-90' : 'text-white/40 bg-white/5 cursor-not-allowed')}
                      style={affordable ? { background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' } : undefined}>
                      <ShoppingCart size={12} /> {fmt(l.price)} mana
                    </button>
                    </>}
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-5">
          {/* Ventes en cours */}
          {mine.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-6">Tu n’as aucune carte en vente.</p>
          ) : (
            <div className="space-y-2">
              {mine.map(l => {
                const def = defs[l.cardId]
                return (
                  <div key={l.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-2.5">
                    <div className="w-12 shrink-0"><CardArt def={def} rarity={l.rarity} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-bold truncate">{def?.name ?? l.cardId}</p>
                      <p className="text-xs"><ManaChip value={l.price} /> <span className="text-white/40">· tu recevras {fmt(Math.floor(l.price * (1 - commission)))}</span></p>
                      <p className="text-white/30 text-[10px] flex items-center gap-1 mt-0.5"><Clock size={10} /> expire le {new Date(l.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <button onClick={() => cancel(l)} disabled={busy === l.id}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-bold hover:bg-white/10 disabled:opacity-50">
                      {busy === l.id ? '…' : 'Retirer'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Dernières ventes conclues */}
          {sold.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Dernières ventes</p>
              <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04]">
                {sold.map(l => (
                  <div key={l.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                    <span className="text-white/70 truncate">{defs[l.cardId]?.name ?? l.cardId} <span className="text-white/30">→ {l.buyerUsername}</span></span>
                    <span className="shrink-0 text-green-300 font-bold tabular-nums">+{fmt(l.sellerGain ?? 0)} mana</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation d'achat */}
      {confirmBuy && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmBuy(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-xs rounded-3xl bg-[#0a0612] border border-white/10 p-5 space-y-4">
            <div className="w-32 mx-auto"><CardArt def={defs[confirmBuy.cardId]} rarity={confirmBuy.rarity} /></div>
            <div className="text-center">
              <p className="text-white font-black">Acheter {defs[confirmBuy.cardId]?.name} ?</p>
              <p className="text-white/50 text-xs mt-1">Vendue par {confirmBuy.sellerUsername}</p>
            </div>
            <div className="flex justify-between text-sm rounded-xl bg-white/[0.04] px-3 py-2">
              <span className="text-white/50">Prix</span><ManaChip value={confirmBuy.price} />
            </div>
            <div className="flex justify-between text-xs px-3 -mt-2">
              <span className="text-white/40">Il te restera</span><span className="text-white/60 tabular-nums">{fmt(mana - confirmBuy.price)} mana</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmBuy(null)} className="flex-1 py-2.5 rounded-xl border border-white/15 text-white/60 text-sm font-bold">Annuler</button>
              <button onClick={() => buy(confirmBuy)} disabled={busy === confirmBuy.id}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
                {busy === confirmBuy.id ? '…' : 'Acheter'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {showSell && (
        <SellModal defs={defs} owned={owned} commission={commission}
          onClose={() => setShowSell(false)}
          onListed={(name) => { setShowSell(false); flash(`${name} est en vente !`); load() }} />
      )}
    </div>
  )
}

// Mise en vente : choix de la carte puis du prix
function SellModal({ defs, owned, commission, onClose, onListed }: {
  defs: Record<string, CardDef>; owned: Record<string, number>; commission: number
  onClose: () => void; onListed: (name: string) => void
}) {
  const [search, setSearch] = useState('')
  const [card, setCard]     = useState<CardDef | null>(null)
  const [price, setPrice]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Cartes possédées vendables (hors cartes promo), triées par rareté
  const sellable = Object.entries(owned)
    .filter(([id, n]) => n > 0 && defs[id] && !isPromoCard(defs[id]))
    .map(([id, n]) => ({ def: defs[id], count: n }))
    .filter(x => x.def.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => RARITY_ORDER.indexOf(a.def.rarity) - RARITY_ORDER.indexOf(b.def.rarity) || a.def.name.localeCompare(b.def.name))

  const min = card ? minPrice(card.rarity) : 1
  const p = Math.floor(Number(price))
  const valid = card && Number.isFinite(p) && p >= min

  function pick(def: CardDef) {
    setCard(def)
    setPrice(String(minPrice(def.rarity) * 3)) // suggestion de départ : 3× la valeur de recyclage
    setError('')
  }

  async function submit() {
    if (!card || !valid) return
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/market', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: card.id, price: p }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erreur'); return }
      onListed(card.name)
    } catch { setError('Erreur réseau') } finally { setSaving(false) }
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full sm:w-[460px] h-[min(620px,90vh)] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#0a0612] border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/[0.06] shrink-0">
          <h3 className="text-white font-black flex items-center gap-2"><Tag size={16} /> {card ? 'Fixer le prix' : 'Choisir une carte à vendre'}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>

        {!card ? (
          <div className="flex-1 min-h-0 flex flex-col px-4 pt-3 pb-4 gap-3">
            <div className="relative shrink-0">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher dans ta collection…"
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[#7b2bff]/60" />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {sellable.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-8">Aucune carte vendable.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2.5">
                  {sellable.map(({ def, count }) => (
                    <button key={def.id} onClick={() => pick(def)} className="relative text-left active:scale-95 transition-transform">
                      <CardArt def={def} rarity={def.rarity} />
                      {count > 1 && (
                        <span className="absolute -top-1.5 -right-1.5 z-30 min-w-5 h-5 px-1 rounded-full bg-black/80 border text-[10px] font-bold text-white flex items-center justify-center"
                          style={{ borderColor: (RARITY_COLOR[def.rarity] ?? '#fff') + '88' }}>{count}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            <div className="flex gap-4 items-center">
              <div className="w-24 shrink-0"><CardArt def={card} rarity={card.rarity} /></div>
              <div className="min-w-0">
                <p className="text-white font-black truncate">{card.name}</p>
                <p className="text-xs font-bold" style={{ color: RARITY_COLOR[card.rarity] }}>{RARITY_LABEL[card.rarity] ?? card.rarity}</p>
                <p className="text-white/40 text-[11px] mt-1">Tu en possèdes {owned[card.id]}. Un exemplaire sera mis de côté pendant la vente.</p>
                <button onClick={() => setCard(null)} className="text-[11px] text-[#a78bfa] hover:text-white mt-1">Changer de carte</button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-white/50 text-xs block">Prix de vente (mana)</label>
              <input type="number" min={min} value={price} onChange={e => setPrice(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-lg font-black text-white tabular-nums focus:outline-none focus:border-[#7b2bff]/60" />
              <div className="flex gap-2">
                {[1, 2, 5, 10].map(m => (
                  <button key={m} onClick={() => setPrice(String(min * m))}
                    className="flex-1 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/60 hover:bg-white/10 tabular-nums">
                    {fmt(min * m)}
                  </button>
                ))}
              </div>
              <p className={cn('text-[11px]', Number.isFinite(p) && p < min ? 'text-red-400' : 'text-white/40')}>
                Minimum {fmt(min)} mana (valeur de recyclage de cette rareté).
              </p>
            </div>

            {valid && (
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-white/50">Prix pour l’acheteur</span><span className="text-white tabular-nums">{fmt(p)} mana</span></div>
                <div className="flex justify-between"><span className="text-white/50">Commission ({Math.round(commission * 100)} %)</span><span className="text-white/50 tabular-nums">−{fmt(p - Math.floor(p * (1 - commission)))}</span></div>
                <div className="flex justify-between font-bold"><span className="text-white/80">Tu recevras</span><ManaChip value={Math.floor(p * (1 - commission))} /></div>
              </div>
            )}

            <p className="text-white/35 text-[11px]">La vente dure 7 jours. Tu peux la retirer à tout moment : la carte revient alors dans ta collection.</p>
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}

            <button onClick={submit} disabled={!valid || saving}
              className="w-full py-3 rounded-xl text-white text-sm font-black disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
              {saving ? 'Mise en vente…' : 'Mettre en vente'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
