'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown, Lock, Gem, Sword, Shield, Link as LinkIcon, Flame, X, ShoppingBag, Search, Trash2, CheckSquare, Square } from 'lucide-react'
import { CardMedia } from '@/components/game/CardMedia'
import { useGameStore } from '@/store/game'
import { useCards } from '@/hooks/useCards'
import { StatePanel } from '@/components/game/StatePanel'
import { cn } from '@/lib/utils'
import { CardModal } from '@/components/game/CardModal'
import { CardHover } from '@/components/game/CardHover'
import { CardFrame } from '@/components/game/CardFrame'
import { MANA_PER_RARITY } from '@/lib/game/mana-constants'

const RARITY_ORDER = ['void','legendary','epic','rare','common']
const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#ec4899',
  rare: '#4aa3ff', common: '#9ca3af',
}
const RARITY_RATES: Record<string, number> = {
  common: 60, rare: 24, epic: 13, legendary: 2.5, void: 0.5,
}
const RARITY_BG: Record<string, string> = {
  void:      'linear-gradient(135deg, #1a0a3a, #0d051f)',
  legendary: 'linear-gradient(135deg, #2a1500, #110800)',
  epic:      'linear-gradient(135deg, #1a0a2e, #0a0518)',
  rare:      'linear-gradient(135deg, #0a1628, #04080f)',
  common:    'linear-gradient(135deg, #111118, #060608)',
}

interface GroupedCard {
  card_id: string
  rarity: string
  family: string
  count: number
  name: string
  image_url: string | null
  description: string | null
  latest_at: string
  cost: number | null
  atk: number | null
  def: number | null
  owned: boolean
  artist: string | null
  artistUrl: string | null
}

const BOOSTER_COST = 150

export default function CollectionPage() {
  const { user, profile: storeProfile } = useGameStore(s => ({ user: s.user, profile: s.profile }))
  const { fetchCards } = useCards()
  const [cards, setCards]         = useState<GroupedCard[]>([])
  const [loading, setLoading]     = useState(true)
  const [rarityFilter, setRarityFilter] = useState<string>('all')
  const [famFilter, setFamFilter]       = useState<string>('all')
  const [search, setSearch]       = useState('')
  const [families, setFamilies]   = useState<{ key: string; label: string }[]>([])
  const [selected, setSelected]   = useState<GroupedCard | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [ovVisible, setOvVisible] = useState<Record<string, boolean>>({})
  const [famOpen, setFamOpen]     = useState(false)
  const [showRates, setShowRates] = useState(false)
  const [mana, setMana]           = useState(0)
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null)

  // Recycling
  const [recycleMode, setRecycleMode]   = useState(false)
  const [recycleSelected, setRecycleSelected] = useState<Record<string, number>>({}) // cardId → qty to recycle
  const [recycling, setRecycling]       = useState(false)
  const [confirmAll, setConfirmAll]     = useState(false)
  const [redeeming, setRedeeming]       = useState(false)
  const [familyPicker, setFamilyPicker] = useState(false)
  const famRef = useRef<HTMLDivElement>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (famRef.current && !famRef.current.contains(e.target as Node)) setFamOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const toggleSection = (r: string) => {
    setOvVisible(s => ({ ...s, [r]: false }))
    setCollapsed(prev => ({ ...prev, [r]: !prev[r] }))
  }
  const ovOpen = (r: string) => ovVisible[r] !== false

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [rawCards, cardDefs, famData] = await Promise.all([
      fetch('/api/collection').then(r => r.ok ? r.json() : []),
      fetchCards(),
      fetch('/api/families').then(r => r.ok ? r.json() : []),
    ])
    if (storeProfile?.mana != null) setMana(storeProfile.mana)

    const defMap: Record<string, { name: string; image_url: string | null; description: string | null; cost: number | null; atk: number | null; def: number | null; artist: string | null; artistUrl: string | null }> = {}
    for (const d of cardDefs ?? []) {
      const meta = typeof d.metadata === 'string' ? (() => { try { return JSON.parse(d.metadata || '{}') } catch { return {} } })() : (d.metadata ?? {})
      defMap[d.id] = {
        name: d.name, image_url: d.imageUrl ?? d.image_url,
        description: d.description ?? null,
        cost: meta?.combat?.cost ?? null, atk: meta?.combat?.atk ?? null, def: meta?.combat?.hp ?? null,
        artist: d.artist ?? null, artistUrl: d.artistUrl ?? d.artist_url ?? null,
      }
    }

    const ownedList: GroupedCard[] = (rawCards ?? []).filter((c: { card_id?: string; cardId?: string }) => defMap[c.card_id ?? c.cardId ?? '']).map((c: { card_id?: string; cardId?: string; rarity: string; family: string; count?: number; last_obtained_at?: string }) => {
      const cardKey = c.card_id ?? c.cardId ?? ''
      const def = defMap[cardKey]
      return { card_id: cardKey, rarity: c.rarity, family: c.family, count: c.count ?? 1,
        name: def?.name ?? cardKey, image_url: def?.image_url ?? null, description: def?.description ?? null,
        latest_at: c.last_obtained_at ?? '', cost: def?.cost ?? null, atk: def?.atk ?? null, def: def?.def ?? null,
        owned: true, artist: def?.artist ?? null, artistUrl: def?.artistUrl ?? null }
    })
    const ownedIds = new Set(ownedList.map(c => c.card_id))
    const lockedList: GroupedCard[] = (cardDefs ?? []).filter((d: { id: string }) => !ownedIds.has(d.id))
      .map((d: { id: string; name?: string; rarity?: string; family?: string; familyKey?: string }) => {
        const def = defMap[d.id]
        return { card_id: d.id, rarity: d.rarity ?? 'common', family: d.family ?? d.familyKey ?? '',
          count: 0, name: def?.name ?? d.name ?? d.id, image_url: def?.image_url ?? null,
          description: def?.description ?? null, latest_at: '', cost: def?.cost ?? null,
          atk: def?.atk ?? null, def: def?.def ?? null, owned: false, artist: def?.artist ?? null, artistUrl: def?.artistUrl ?? null }
      })

    const sorted = [...ownedList, ...lockedList].sort((a, b) => {
      const ri = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
      return ri !== 0 ? ri : a.name.localeCompare(b.name)
    })
    setCards(sorted)
    setFamilies(famData)
    setLoading(false)
  }, [user]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  // Cartes recyclables = owned + count > 1
  const recyclableCards = cards.filter(c => c.owned && c.count > 1)

  const totalRecycleMana = Object.entries(recycleSelected).reduce((sum, [cardId, qty]) => {
    const card = cards.find(c => c.card_id === cardId)
    return sum + (MANA_PER_RARITY[card?.rarity ?? ''] ?? 0) * qty
  }, 0)
  const totalRecycleCards = Object.values(recycleSelected).reduce((a, b) => a + b, 0)

  const toggleCard = (card: GroupedCard) => {
    const max = card.count - 1
    setRecycleSelected(prev => {
      if (prev[card.card_id]) {
        const { [card.card_id]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [card.card_id]: max }
    })
  }

  const toggleRarity = (rarity: string) => {
    const group = recyclableCards.filter(c => c.rarity === rarity)
    const allSelected = group.every(c => recycleSelected[c.card_id])
    setRecycleSelected(prev => {
      const next = { ...prev }
      if (allSelected) { group.forEach(c => { delete next[c.card_id] }) }
      else { group.forEach(c => { next[c.card_id] = c.count - 1 }) }
      return next
    })
  }

  const clearSelection = () => setRecycleSelected({})

  const handleBatchRecycle = async (items: { cardId: string; quantity: number }[]) => {
    if (!items.length || recycling) return
    setRecycling(true)
    const res = await fetch('/api/mana/trade/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    const data = await res.json()
    setRecycling(false)
    if (!res.ok) { showToast(data.error ?? 'Erreur', false); return }
    setMana(data.manaTotal)
    const recycledMap: Record<string, number> = {}
    items.forEach(({ cardId, quantity }) => { recycledMap[cardId] = quantity })
    setCards(prev => prev.map(c => recycledMap[c.card_id] ? { ...c, count: c.count - recycledMap[c.card_id] } : c))
    showToast(`+${data.manaGain.toLocaleString('fr-FR')} mana !`)
    setRecycleMode(false)
    setRecycleSelected({})
    setConfirmAll(false)
  }

  const handleRecycleSelected = () => {
    const items = Object.entries(recycleSelected).map(([cardId, quantity]) => ({ cardId, quantity }))
    handleBatchRecycle(items)
  }

  const handleRecycleAll = () => {
    const items = recyclableCards.map(c => ({ cardId: c.card_id, quantity: c.count - 1 }))
    handleBatchRecycle(items)
  }

  const allRecycleAllMana = recyclableCards.reduce((sum, c) => sum + (MANA_PER_RARITY[c.rarity] ?? 0) * (c.count - 1), 0)

  const handleRedeem = async (family: string) => {
    if (redeeming || mana < BOOSTER_COST) return
    setFamilyPicker(false)
    setRedeeming(true)
    const res = await fetch('/api/mana/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ family }),
    })
    const data = await res.json()
    setRedeeming(false)
    if (!res.ok) { showToast(data.error ?? 'Erreur', false); return }
    setMana(data.manaRemaining)
    showToast('Booster ajouté à tes crédits !')
  }

  const filtered = cards.filter(c => {
    const matchRarity = rarityFilter === 'all' || c.rarity === rarityFilter
    const matchFam    = famFilter === 'all' || c.family === famFilter
    const matchSearch = !search.trim() || c.name.toLowerCase().includes(search.toLowerCase())
    return matchRarity && matchFam && matchSearch
  })
  const rarityGroups = RARITY_ORDER.filter(r => filtered.some(c => c.rarity === r))

  if (!user) return (
    <StatePanel icon={LinkIcon} title="Pas connecté">
      Connecte-toi pour voir et compléter ta collection.
    </StatePanel>
  )

  return (
    <div className="pb-4 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="sticky top-20 z-20 py-4 mb-10 backdrop-blur-md flex flex-col justify-center rounded-xl" style={{ backgroundColor: 'rgba(8,10,18,0.82)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-4">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-bold text-white text-base shrink-0">Ma collection</h2>
            <span className="text-white/40 text-xs truncate">{cards.filter(c => c.owned).length} / {cards.length} · {cards.reduce((a, c) => a + c.count, 0)} copies</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Recycler */}
            {recyclableCards.length > 0 && (
              <button
                onClick={() => { setRecycleMode(v => !v); clearSelection() }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-90"
                style={recycleMode
                  ? { background: 'rgba(123,43,255,0.35)', border: '1px solid rgba(168,85,247,0.6)', color: '#e9d5ff' }
                  : { background: 'rgba(123,43,255,0.15)', border: '1px solid rgba(123,43,255,0.35)', color: '#c084fc' }}
              >
                <Flame size={12} /> {recycleMode ? 'Annuler' : 'Recycler'}
              </button>
            )}
            {/* Recycler tout */}
            {recyclableCards.length > 0 && (
              <button
                onClick={() => setConfirmAll(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-90"
                style={{ background: 'rgba(255,100,50,0.12)', border: '1px solid rgba(255,100,50,0.3)', color: '#fb923c' }}
              >
                <Trash2 size={12} /> Recycler tout
              </button>
            )}
            {/* Booster */}
            <button
              onClick={() => mana >= BOOSTER_COST && setFamilyPicker(true)}
              disabled={mana < BOOSTER_COST || redeeming}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={mana >= BOOSTER_COST
                ? { background: 'linear-gradient(135deg,#7b2bff,#a855f7)', color: '#fff', boxShadow: '0 0 12px rgba(123,43,255,0.4)' }
                : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}
              title={`Obtenir 1 booster pour ${BOOSTER_COST} mana`}
            >
              <ShoppingBag size={12} />
              <span className="hidden sm:inline">Booster</span> ({BOOSTER_COST})
            </button>
            {/* Mana */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(123,43,255,0.12)', border: '1px solid rgba(123,43,255,0.25)' }}>
              <Flame size={12} className="text-[#a78bfa]" />
              <span className="text-[#a78bfa] font-black">{mana.toLocaleString('fr-FR')}</span>
              <span className="text-white/30 hidden sm:inline">mana</span>
            </div>
          </div>
        </div>

        {/* Barre de confirmation recyclage */}
        {recycleMode && (
          <div className="flex items-center gap-3 px-4 pt-2 pb-1">
            <Flame size={13} className="text-[#a78bfa] shrink-0" />
            {totalRecycleCards > 0 ? (
              <>
                <span className="text-white font-bold text-sm">{totalRecycleCards} carte{totalRecycleCards > 1 ? 's' : ''}</span>
                <span className="text-[#a78bfa] font-black text-sm">+{totalRecycleMana.toLocaleString('fr-FR')} mana</span>
              </>
            ) : (
              <span className="text-white/35 text-sm">Sélectionne des cartes à recycler</span>
            )}
            <button
              onClick={handleRecycleSelected}
              disabled={totalRecycleCards === 0 || recycling}
              className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg,#7b2bff,#a855f7)', color: '#fff' }}>
              {recycling ? 'Recyclage…' : 'Recycler'}
            </button>
          </div>
        )}

        {/* Filtres */}
        <div className="flex items-center justify-center gap-2 px-4">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide min-w-0">
            <button onClick={() => setRarityFilter('all')}
              className={cn('px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all',
                rarityFilter === 'all' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/60')}>
              Tout
            </button>
            {RARITY_ORDER.filter(r => cards.some(c => c.rarity === r)).map(r => (
              <button key={r} onClick={() => setRarityFilter(rarityFilter === r ? 'all' : r)}
                className={cn('px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all capitalize',
                  rarityFilter === r ? 'text-white' : 'text-white/40 hover:text-white/60')}
                style={rarityFilter === r ? { background: RARITY_COLOR[r] + '30', color: RARITY_COLOR[r] } : {}}>
                {r}
              </button>
            ))}
          </div>

          {families.length > 0 && (
            <>
              <div className="w-px h-4 bg-white/10 shrink-0" />
              <div ref={famRef} className="relative shrink-0">
                <button
                  onClick={() => setFamOpen(v => !v)}
                  className={cn('flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all',
                    famFilter !== 'all' ? 'text-[#a78bfa]' : 'text-white/40 hover:text-white/60')}
                  style={famFilter !== 'all' ? { background:'rgba(123,43,255,0.2)', border:'1px solid rgba(123,43,255,0.4)' } : { border:'1px solid rgba(255,255,255,0.08)' }}
                >
                  {families.find(f => f.key === famFilter)?.label ?? 'Famille'}
                  <ChevronDown size={11} className={cn('transition-transform', famOpen && 'rotate-180')} />
                </button>
                {famOpen && (
                  <div className="absolute top-full mt-1 right-0 z-50 min-w-[140px] rounded-xl overflow-hidden"
                    style={{ background:'#0d0d1a', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 8px 32px rgba(0,0,0,0.6)' }}>
                    {famFilter !== 'all' && (
                      <button onClick={() => { setFamFilter('all'); setFamOpen(false) }}
                        className="w-full text-left px-4 py-2 text-xs text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors">
                        Toutes les familles
                      </button>
                    )}
                    {families.map(f => (
                      <button key={f.key} onClick={() => { setFamFilter(f.key); setFamOpen(false) }}
                        className={cn('w-full text-left px-4 py-2 text-xs font-bold transition-colors',
                          famFilter === f.key ? 'text-[#a78bfa] bg-[#7b2bff]/15' : 'text-white/60 hover:text-white hover:bg-white/5')}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="w-px h-4 bg-white/10 shrink-0" />
          <div className="relative shrink-0"
            onMouseEnter={() => setShowRates(true)} onMouseLeave={() => setShowRates(false)}>
            <button onClick={() => setShowRates(v => !v)} aria-label="Taux d'apparition"
              className="w-6 h-6 rounded-full border border-white/15 text-white/50 hover:text-white hover:border-white/40 flex items-center justify-center text-[11px] font-bold transition-colors">
              ?
            </button>
            {showRates && (
              <div className="absolute top-full right-0 mt-2 w-56 p-3.5 rounded-xl z-50"
                style={{ background:'#0d0d1a', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 8px 32px rgba(0,0,0,0.6)' }}>
                <p className="text-white font-bold text-xs mb-2.5">Taux d&apos;apparition</p>
                <div className="space-y-1.5">
                  {RARITY_ORDER.filter(r => RARITY_RATES[r] != null).map(r => (
                    <div key={r} className="flex items-center justify-between gap-3 text-[11px]">
                      <span className="capitalize font-bold" style={{ color: RARITY_COLOR[r] }}>{r}</span>
                      <span className="text-white/55 font-mono">{RARITY_RATES[r]}%</span>
                    </div>
                  ))}
                </div>
                <p className="text-white/25 text-[9px] mt-2.5 leading-snug">Taux de base par booster, hors pity.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recherche */}
        <div className="flex items-center justify-center px-4 pt-2">
          <div className="relative w-full max-w-sm">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une carte…"
              className="w-full pl-7 pr-7 py-1.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#7b2bff]/50" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                <X size={11} />
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/30 text-sm">Chargement…</div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-white/30 text-sm">Aucune carte dans ta collection.</p>
          <p className="text-white/20 text-xs">Ouvre des boosters pour commencer !</p>
        </div>
      ) : (
        <div className="space-y-6">
          {rarityGroups.map(r => {
            const group = filtered.filter(c => c.rarity === r)
            if (!group.length) return null
            const isOpen = !collapsed[r]
            return (
              <div key={r}>
                <div className="flex items-center gap-2 mb-3">
                  {recycleMode && (() => {
                    const groupRecyclable = group.filter(c => c.owned && c.count > 1)
                    if (!groupRecyclable.length) return null
                    const allSel = groupRecyclable.every(c => recycleSelected[c.card_id])
                    return (
                      <button onClick={() => toggleRarity(r)} className="shrink-0 transition-opacity hover:opacity-80">
                        {allSel
                          ? <CheckSquare size={15} style={{ color: RARITY_COLOR[r] }} />
                          : <Square size={15} className="text-white/30" />}
                      </button>
                    )
                  })()}
                  <button onClick={() => toggleSection(r)} className="flex items-center gap-2 flex-1 min-w-0">
                    <ChevronDown size={14} className="transition-transform duration-300 shrink-0"
                      style={{ color: RARITY_COLOR[r], transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: RARITY_COLOR[r] }}>{r}</span>
                    <div className="flex-1 h-px" style={{ background: RARITY_COLOR[r] + '30' }} />
                    <span className="text-white/30 text-xs">{group.length}</span>
                  </button>
                </div>
                <div className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                  onTransitionEnd={e => { if (e.propertyName === 'grid-template-rows' && !collapsed[r]) setOvVisible(s => ({ ...s, [r]: true })) }}>
                  <div style={{ overflow: ovOpen(r) ? 'visible' : 'hidden', minWidth: 0 }}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-8">
                      {group.map(card => (
                        !card.owned ? (
                          <div key={card.card_id} className="flex flex-col gap-1.5">
                            <div className="relative rounded-[12px] overflow-hidden border border-white/[0.06] bg-black/40" style={{ aspectRatio: '0.714' }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="/assets/back.png" alt="" draggable={false} className="w-full h-full object-cover select-none"
                                style={{ filter: 'grayscale(1) brightness(0.32) contrast(0.9)' }} />
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center">
                                <Lock size={22} className="text-white/45" />
                                <span className="text-white/75 text-[11px] font-bold leading-tight line-clamp-2 uppercase">{card.name}</span>
                                <span className="text-white/35 text-[8px] font-bold uppercase tracking-widest">Pas encore découverte</span>
                              </div>
                            </div>
                            <div className="min-h-[30px]" />
                          </div>
                        ) : (
                          <div key={card.card_id} className="flex flex-col">
                            {recycleMode && card.count > 1 && (
                              <button onClick={() => toggleCard(card)}
                                className="mb-1.5 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-bold transition-all hover:opacity-90"
                                style={recycleSelected[card.card_id]
                                  ? { background: RARITY_COLOR[card.rarity] + '25', border: `1px solid ${RARITY_COLOR[card.rarity]}60`, color: RARITY_COLOR[card.rarity] }
                                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }}>
                                {recycleSelected[card.card_id]
                                  ? <><CheckSquare size={10} /> Sélectionnée</>
                                  : <><Square size={10} /> Sélectionner</>}
                              </button>
                            )}
                            <CardHover rarity={card.rarity} className="relative cursor-pointer active:scale-95" style={{ aspectRatio: '0.714', overflow: 'visible' }}>
                              <CardFrame rarity={card.rarity} name={card.name} cost={card.cost} atk={card.atk} def={card.def} glow={false} hideStats style={{ position: 'absolute', inset: 0 }}>
                                <button onClick={() => setSelected(card)} className="absolute inset-0 w-full h-full">
                                  {card.image_url ? (
                                    <CardMedia src={card.image_url} alt={card.name} />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <div className="w-12 h-12 rounded-full opacity-30"
                                        style={{ background: `radial-gradient(circle, ${RARITY_COLOR[card.rarity]}, transparent)` }} />
                                    </div>
                                  )}
                                </button>
                              </CardFrame>
                              {card.count > 1 && (
                                <div className="absolute -top-2 -right-2 z-30 w-6 h-6 rounded-full bg-black/80 border-2 flex items-center justify-center text-[10px] font-bold text-white shadow-lg"
                                  style={{ borderColor: RARITY_COLOR[card.rarity] + '66', boxShadow: `0 0 8px ${RARITY_COLOR[card.rarity]}66` }}>
                                  {card.count}
                                </div>
                              )}
                              <div className="absolute left-0 right-0 flex items-center justify-center gap-1" style={{ top: '100%', marginTop: 6 }}>
                                {card.cost != null && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-white/[0.05] border text-white/80"
                                    style={{ borderColor: RARITY_COLOR[card.rarity] + '55' }} title="Coût">
                                    <Gem size={11} style={{ color: RARITY_COLOR[card.rarity] }} />{card.cost}
                                  </span>
                                )}
                                {card.atk != null && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-white/[0.05] border border-white/10 text-white/80" title="Attaque">
                                    <Sword size={11} className="text-rose-300/90" />{card.atk}
                                  </span>
                                )}
                                {card.def != null && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-white/[0.05] border border-white/10 text-white/80" title="Défense">
                                    <Shield size={11} className="text-sky-300/90" />{card.def}
                                  </span>
                                )}
                              </div>
                            </CardHover>
                            <div className="min-h-[30px]" />
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <CardModal name={selected.name} rarity={selected.rarity} family={selected.family}
          artUrl={selected.image_url} description={selected.description} count={selected.count}
          artist={selected.artist} artistUrl={selected.artistUrl} onClose={() => setSelected(null)} />
      )}


      {/* ── Picker famille booster ── */}
      {familyPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: 'rgba(14,10,31,0.98)', border: '1px solid rgba(168,85,247,0.25)', boxShadow: '0 24px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04) inset' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white font-black text-base">Choisir un booster</p>
                <p className="text-white/40 text-xs mt-1">Le booster ne contiendra que des cartes de cette famille.</p>
              </div>
              <button onClick={() => setFamilyPicker(false)} className="text-white/25 hover:text-white/60 transition-colors shrink-0 mt-0.5"><X size={17} /></button>
            </div>
            <div className="flex flex-col gap-2">
              {/* Void = toutes familles */}
              <button onClick={() => handleRedeem('void')}
                className="flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,rgba(168,85,247,0.2),rgba(123,43,255,0.1))', border: '1px solid rgba(168,85,247,0.3)', color: '#e9d5ff' }}>
                <span>✨ Void</span>
                <span className="text-white/40 text-xs font-normal">{BOOSTER_COST} mana</span>
              </button>
              {families.filter(f => f.key !== 'global').map(f => (
                <button key={f.key} onClick={() => handleRedeem(f.key)}
                  className="flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 hover:opacity-90"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' }}>
                  <span className="capitalize">{f.label}</span>
                  <span className="text-white/40 text-xs font-normal">{BOOSTER_COST} mana</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm recycler tout ── */}
      {confirmAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: 'rgba(14,10,31,0.98)', border: '1px solid rgba(168,85,247,0.25)', boxShadow: '0 24px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04) inset' }}>
            {/* Titre */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white font-black text-base">Recycler toutes les copies ?</p>
                <p className="text-white/40 text-xs mt-1">Tu gardes 1 exemplaire de chaque carte. Les doublons sont convertis en mana.</p>
              </div>
              <button onClick={() => setConfirmAll(false)} className="text-white/25 hover:text-white/60 transition-colors shrink-0 mt-0.5"><X size={17} /></button>
            </div>
            {/* Résumé */}
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: 'rgba(123,43,255,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
              <span className="text-white/50 text-sm">{recyclableCards.reduce((s, c) => s + c.count - 1, 0)} copies</span>
              <div className="flex items-center gap-1.5">
                <Flame size={13} className="text-[#a78bfa]" />
                <span className="text-[#c4b5fd] font-black text-lg">{allRecycleAllMana.toLocaleString('fr-FR')}</span>
                <span className="text-white/40 text-sm">mana</span>
              </div>
            </div>
            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={() => setConfirmAll(false)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                Annuler
              </button>
              <button onClick={handleRecycleAll} disabled={recycling}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#7b2bff,#a855f7)', color: '#fff', boxShadow: '0 4px 20px rgba(123,43,255,0.35)' }}>
                <Flame size={13} />
                {recycling ? 'Recyclage…' : 'Tout recycler'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl text-sm font-bold shadow-xl pointer-events-none transition-all"
          style={{
            background: toast.ok ? 'rgba(0,200,150,0.15)' : 'rgba(255,60,60,0.15)',
            border: `1px solid ${toast.ok ? 'rgba(0,200,150,0.4)' : 'rgba(255,60,60,0.4)'}`,
            color: toast.ok ? '#4a9e6a' : '#ff6b6b',
            backdropFilter: 'blur(12px)',
          }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
