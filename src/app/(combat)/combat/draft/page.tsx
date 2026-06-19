'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Swords, X, Zap, Sword, Bot, Search, ChevronDown, Shuffle } from 'lucide-react'
import { useGameStore } from '@/store/game'
import { cn } from '@/lib/utils'
import { CardFrame } from '@/components/game/CardFrame'
import { CardHover } from '@/components/game/CardHover'
import { CardMedia } from '@/components/game/CardMedia'

const DECK_SIZE   = 24
const MANA_BUDGET = 72

const MAX_COPIES: Record<string, number> = {
  void: 1, legendary: 1, epic: 2, rare: 3, common: 4,
}

const RARITY_ORDER = ['void', 'legendary', 'epic', 'rare', 'common']
const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#ec4899',
  rare: '#4aa3ff', common: '#9ca3af',
}

interface DraftCard {
  card_id: string
  rarity: string
  family: string
  name: string
  image_url: string | null
  ownedCount: number
  atk: number
  hp: number
  cost: number
}

interface SelectedEntry {
  card: DraftCard
  qty: number
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function DraftPage() {
  return <Suspense><DraftContent /></Suspense>
}

function DraftContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const isFriendly   = searchParams.get('mode') === 'friendly'
  const challengeId  = searchParams.get('challenge')
  const challengedFriend = isFriendly
    ? JSON.parse(sessionStorage.getItem('challenge_friend') ?? 'null') as { id: string; username: string } | null
    : null
  const { user } = useGameStore(s => ({ user: s.user }))
  const [cards, setCards]       = useState<DraftCard[]>([])
  const [families, setFamilies] = useState<{ key: string; label: string }[]>([])
  const [selected, setSelected] = useState<SelectedEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<string>('all')
  const [search, setSearch]     = useState('')
  const [famOpen, setFamOpen]   = useState(false)
  const famRef                  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (famRef.current && !famRef.current.contains(e.target as Node)) setFamOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [rawCards, cardDefs, famData] = await Promise.all([
      fetch('/api/collection').then(r => r.ok ? r.json() : []),
      fetch('/api/cards').then(r => r.ok ? r.json() : []),
      fetch('/api/families').then(r => r.ok ? r.json() : []),
    ])

    const defMap: Record<string, { name: string; image_url: string | null; metadata: Record<string, unknown> }> = {}
    for (const d of cardDefs ?? []) {
      const meta = typeof d.metadata === 'string' ? (() => { try { return JSON.parse(d.metadata || '{}') } catch { return {} } })() : (d.metadata ?? {})
      defMap[d.id] = { name: d.name, image_url: d.imageUrl ?? d.image_url, metadata: meta }
    }

    const sorted = (rawCards ?? []).map((c: { card_id?: string; cardId?: string; rarity: string; family: string; count?: number }) => {
      const cardKey = c.card_id ?? c.cardId ?? ''
      const def = defMap[cardKey]
      const combat = (def?.metadata?.combat ?? { atk: 1, hp: 2, cost: 1 }) as { atk: number; hp: number; cost: number }
      return {
        card_id: cardKey, rarity: c.rarity, family: c.family,
        name: def?.name ?? cardKey, image_url: def?.image_url ?? null,
        ownedCount: c.count ?? 1,
        atk: combat.atk ?? 1, hp: combat.hp ?? 2, cost: combat.cost ?? 1,
      }
    }).sort((a: DraftCard, b: DraftCard) => {
      const ri = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
      return ri !== 0 ? ri : a.name.localeCompare(b.name)
    })

    setCards(sorted)
    setFamilies(famData ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const totalCards = selected.reduce((s, e) => s + e.qty, 0)
  const totalMana  = selected.reduce((s, e) => s + e.card.cost * e.qty, 0)
  const manaOver   = totalMana > MANA_BUDGET

  function getQty(card_id: string) {
    return selected.find(e => e.card.card_id === card_id)?.qty ?? 0
  }

  function canAdd(card: DraftCard, currentSelected = selected): { ok: boolean; reason?: string } {
    const curTotal = currentSelected.reduce((s, e) => s + e.qty, 0)
    const curMana  = currentSelected.reduce((s, e) => s + e.card.cost * e.qty, 0)
    if (curTotal >= DECK_SIZE)                    return { ok: false, reason: 'Deck plein' }
    if (curMana > MANA_BUDGET)                    return { ok: false, reason: 'Budget mana dépassé' }
    const qty = currentSelected.find(e => e.card.card_id === card.card_id)?.qty ?? 0
    const max = Math.min(MAX_COPIES[card.rarity] ?? 1, card.ownedCount)
    if (qty >= max)                               return { ok: false, reason: `Max ${max}` }
    if (curMana + card.cost > MANA_BUDGET)        return { ok: false, reason: 'Budget mana dépassé' }
    return { ok: true }
  }

  function add(card: DraftCard) {
    if (!canAdd(card).ok) return
    setSelected(prev => {
      const entry = prev.find(e => e.card.card_id === card.card_id)
      if (entry) return prev.map(e => e.card.card_id === card.card_id ? { ...e, qty: e.qty + 1 } : e)
      return [...prev, { card, qty: 1 }]
    })
  }

  function remove(card_id: string) {
    setSelected(prev => {
      const entry = prev.find(e => e.card.card_id === card_id)
      if (!entry) return prev
      if (entry.qty <= 1) return prev.filter(e => e.card.card_id !== card_id)
      return prev.map(e => e.card.card_id === card_id ? { ...e, qty: e.qty - 1 } : e)
    })
  }

  function autoDeck() {
    const pool = shuffle([...cards])
    let deck: SelectedEntry[] = []
    for (const card of pool) {
      const max = Math.min(MAX_COPIES[card.rarity] ?? 1, card.ownedCount)
      for (let i = 0; i < max; i++) {
        if (canAdd(card, deck).ok) {
          const entry = deck.find(e => e.card.card_id === card.card_id)
          if (entry) deck = deck.map(e => e.card.card_id === card.card_id ? { ...e, qty: e.qty + 1 } : e)
          else deck = [...deck, { card, qty: 1 }]
        }
      }
      if (deck.reduce((s, e) => s + e.qty, 0) >= DECK_SIZE) break
    }
    setSelected(deck)
  }

  function buildDeckPayload() {
    const deck: unknown[] = []
    for (const { card, qty } of selected) {
      for (let i = 0; i < qty; i++) {
        deck.push({ id: `${card.card_id}_${i}`, name: card.name, rarity: card.rarity, family: card.family, image_url: card.image_url, qty: 1, metadata: { combat: { atk: card.atk, hp: card.hp, cost: card.cost, effects: [] } } })
      }
    }
    return deck
  }

  async function handleQueue() {
    if (totalCards < DECK_SIZE || manaOver) return
    const deck = buildDeckPayload()
    sessionStorage.setItem('draft_deck', JSON.stringify(deck))

    // Réponse à un défi direct → accepter le challenge et rejoindre
    if (challengeId) {
      const res = await fetch(`/api/combat/challenges/${challengeId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deck }),
      })
      if (res.ok) {
        const { sessionId } = await res.json()
        sessionStorage.removeItem('draft_deck')
        sessionStorage.removeItem('pending_challenge_id')
        router.push(`/combat/${sessionId}`)
      }
      return
    }

    router.push(isFriendly ? '/combat/matchmaking?mode=friendly' : '/combat/matchmaking')
  }

  function handleTraining() {
    if (totalCards < 1) return
    sessionStorage.setItem('draft_deck', JSON.stringify(buildDeckPayload()))
    router.push('/combat/training')
  }

  const isFamilyFilter = families.some(f => f.key === filter)
  const filtered = cards.filter(c => {
    const matchRarity = filter === 'all' || isFamilyFilter ? true : c.rarity === filter
    const matchFamily = isFamilyFilter ? c.family === filter : true
    const matchSearch = search.trim() === '' || c.name.toLowerCase().includes(search.toLowerCase())
    return matchRarity && matchFamily && matchSearch
  })
  const rarities  = RARITY_ORDER.filter(r => cards.some(c => c.rarity === r))
  const manaRatio = Math.min(1, totalMana / MANA_BUDGET)
  const ready     = totalCards === DECK_SIZE && !manaOver

  return (
    <div className="pb-4 min-h-screen" style={{ background: '#06010e', color: '#f6f1ff' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#06010e]/95 backdrop-blur-md pt-3 pb-3 mb-4 px-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => router.push('/communaute')} className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors">
            <ArrowLeft size={16} /> Retour
          </button>
          <div className="flex gap-2">
            <button onClick={autoDeck}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10"
              title="Remplir automatiquement le deck aléatoirement">
              <Shuffle size={13} /> Auto
            </button>
            <button onClick={handleTraining} disabled={totalCards < 1}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',
                totalCards >= 1 ? 'bg-white/5 border-white/10 text-[#a78bfa] hover:bg-white/10' : 'border-transparent bg-white/5 text-white/20 cursor-not-allowed')}
              title="Jouer contre le bot (aucun point classé)">
              <Bot size={13} /> Entraînement
            </button>
            <button onClick={handleQueue} disabled={!ready}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                ready ? 'bg-[#7b2bff] text-white hover:bg-[#6920e0]' : 'bg-white/5 text-white/20 cursor-not-allowed'
              )}>
              <Swords size={13} /> Chercher un match
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-bold text-white text-base">Construction du deck</h2>
          {isFriendly && challengedFriend && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#7b2bff]/15 border border-[#7b2bff]/30 text-[#a78bfa]">
              <Sword size={10} /> vs {challengedFriend.username}
            </span>
          )}
          {!isFriendly && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#ff9a3d]/10 border border-[#ff9a3d]/30 text-[#ff9a3d]">Ranked</span>
          )}
        </div>

        {/* Compteurs */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-white/40 font-bold">CARTES</span>
              <span className={cn('font-bold', totalCards === DECK_SIZE ? 'text-[#00c896]' : 'text-white/60')}>
                {totalCards}/{DECK_SIZE}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-[#7b2bff] transition-all duration-300"
                style={{ width: `${(totalCards / DECK_SIZE) * 100}%` }} />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-white/40 font-bold flex items-center gap-1"><Zap size={9} /> BUDGET</span>
              <span className={cn('font-bold', manaOver ? 'text-red-400' : totalMana > MANA_BUDGET * 0.85 ? 'text-[#ff9a3d]' : 'text-white/60')}>
                {totalMana}/{MANA_BUDGET}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${manaRatio * 100}%`, background: manaOver ? '#ef4444' : totalMana > MANA_BUDGET * 0.85 ? '#ff9a3d' : '#4aa3ff' }} />
            </div>
          </div>
        </div>

        {/* Règles */}
        <div className="flex gap-2 flex-wrap mb-3">
          {Object.entries(MAX_COPIES).map(([r, max]) => (
            <span key={r} className="text-[9px] px-1.5 py-0.5 rounded-full border"
              style={{ color: RARITY_COLOR[r], borderColor: RARITY_COLOR[r] + '40', background: RARITY_COLOR[r] + '10' }}>
              {r} ×{max}
            </span>
          ))}
        </div>

        {/* Recherche + filtres */}
        <div className="flex items-center gap-2 mb-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs focus:border-[#7b2bff]/50 focus:outline-none text-white placeholder:text-white/25"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                <X size={11} />
              </button>
            )}
          </div>

          {/* Famille dropdown */}
          {families.length > 0 && (
            <div ref={famRef} className="relative flex-shrink-0">
              <button onClick={() => setFamOpen(v => !v)}
                className={cn('flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border',
                  isFamilyFilter ? 'text-[#a78bfa] bg-[#7b2bff]/15 border-[#7b2bff]/40' : 'text-white/40 hover:text-white/60 border-white/10 bg-white/5')}>
                {families.find(f => f.key === filter)?.label ?? 'Famille'}
                <ChevronDown size={11} className={cn('transition-transform', famOpen && 'rotate-180')} />
              </button>
              {famOpen && (
                <div className="absolute top-full mt-1 right-0 z-50 min-w-[140px] rounded-xl overflow-hidden"
                  style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                  {isFamilyFilter && (
                    <button onClick={() => { setFilter('all'); setFamOpen(false) }}
                      className="w-full text-left px-4 py-2 text-xs text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors">
                      Toutes
                    </button>
                  )}
                  {families.map(f => (
                    <button key={f.key} onClick={() => { setFilter(f.key); setFamOpen(false) }}
                      className={cn('w-full text-left px-4 py-2 text-xs font-bold transition-colors',
                        filter === f.key ? 'text-[#a78bfa] bg-[#7b2bff]/15' : 'text-white/60 hover:text-white hover:bg-white/5')}>
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filtres rareté */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button onClick={() => setFilter('all')}
            className={cn('px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all',
              filter === 'all' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/60')}>
            Tout
          </button>
          {rarities.map(r => (
            <button key={r} onClick={() => setFilter(filter === r ? 'all' : r)}
              className={cn('px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap capitalize transition-all',
                filter === r ? 'text-white' : 'text-white/40')}
              style={filter === r ? { background: RARITY_COLOR[r] + '30', color: RARITY_COLOR[r] } : {}}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Deck sélectionné */}
      {selected.length > 0 && (
        <div className="mb-4 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider">Deck sélectionné</p>
            <button onClick={() => setSelected([])} className="text-white/20 hover:text-red-400 text-[10px] transition-colors">
              Vider
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selected.map(({ card, qty }) => (
              <div key={card.card_id} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10"
                style={{ background: RARITY_COLOR[card.rarity] + '15' }}>
                <span className="text-[10px] font-bold uppercase" style={{ color: RARITY_COLOR[card.rarity] }}>{card.name}</span>
                {qty > 1 && <span className="text-[9px] text-white/40">×{qty}</span>}
                <button onClick={() => remove(card.card_id)} className="text-white/30 hover:text-red-400 transition-colors ml-0.5">
                  <X size={9} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grille */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/30 text-sm">Chargement…</div>
      ) : cards.length === 0 ? (
        <div className="text-center py-20 text-white/30 text-sm">Aucune carte dans ta collection.</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-white/20 text-sm">Aucune carte trouvée.</div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-2 px-2 pb-8">
          {filtered.map(card => {
            const qty    = getQty(card.card_id)
            const max    = Math.min(MAX_COPIES[card.rarity] ?? 1, card.ownedCount)
            const { ok, reason } = canAdd(card)

            return (
              <div key={card.card_id} className="relative">
                <CardHover
                  rarity={card.rarity}
                  className={cn('relative cursor-pointer active:scale-95 transition-opacity', !ok && 'opacity-40 cursor-not-allowed')}
                  style={{ aspectRatio: '0.714', overflow: 'visible' }}
                >
                  <CardFrame
                    rarity={card.rarity}
                    name={card.name}
                    cost={card.cost}
                    atk={card.atk}
                    def={card.hp}
                    glow={qty > 0}
                    style={{ position: 'absolute', inset: 0 }}
                  >
                    <button onClick={() => add(card)} disabled={!ok} title={!ok ? reason : undefined}
                      className="absolute inset-0 w-full h-full">
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

                  {qty > 0 && (
                    <div className="absolute -top-2 -right-2 z-30 w-6 h-6 rounded-full bg-[#7b2bff] border-2 border-black flex items-center justify-center text-[10px] font-black text-white shadow-lg">
                      {qty}
                    </div>
                  )}

                  <div className="absolute -bottom-5 left-0 right-0 text-center">
                    <span className="text-[9px] text-white/30">{qty}/{max} · {card.ownedCount}×</span>
                  </div>
                </CardHover>

                {qty > 0 && (
                  <button onClick={() => remove(card.card_id)}
                    className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center hover:bg-red-500 transition-colors z-30">
                    <X size={9} className="text-white" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
