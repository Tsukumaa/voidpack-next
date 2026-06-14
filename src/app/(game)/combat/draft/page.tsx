'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Swords, Check, X, Zap, Sword } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useGameStore } from '@/store/game'
import { cn } from '@/lib/utils'

const DECK_SIZE   = 24
const MANA_BUDGET = 72 // coût total max (moyenne 3/carte)

const MAX_COPIES: Record<string, number> = {
  void: 1, legendary: 1, epic: 2, rare: 3, uncommon: 3, common: 4,
}

const RARITY_ORDER = ['void', 'legendary', 'epic', 'rare', 'uncommon', 'common']
const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#b86dff',
  rare: '#4aa3ff', uncommon: '#22c55e', common: '#9ca3af',
}
const RARITY_BG: Record<string, string> = {
  void:      'linear-gradient(135deg, #1a0a3a, #0d051f)',
  legendary: 'linear-gradient(135deg, #2a1500, #110800)',
  epic:      'linear-gradient(135deg, #1a0a2e, #0a0518)',
  rare:      'linear-gradient(135deg, #0a1628, #04080f)',
  uncommon:  'linear-gradient(135deg, #0a1f10, #040a06)',
  common:    'linear-gradient(135deg, #111118, #060608)',
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

export default function DraftPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const isFriendly   = searchParams.get('mode') === 'friendly'
  const challengedFriend = isFriendly
    ? JSON.parse(sessionStorage.getItem('challenge_friend') ?? 'null') as { id: string; username: string } | null
    : null
  const { user } = useGameStore(s => ({ user: s.user }))
  const [cards, setCards]       = useState<DraftCard[]>([])
  const [selected, setSelected] = useState<SelectedEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<string>('all')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const sb = createClient()

    const { data: rawCards } = await sb
      .from('player_cards')
      .select('card_id, rarity, family, metadata')
      .eq('user_id', user.id)

    const { data: cardDefs } = await sb
      .from('custom_cards')
      .select('id, name, image_url, rarity, family, metadata')

    const defMap: Record<string, { name: string; image_url: string | null; metadata: Record<string, unknown> }> = {}
    for (const d of cardDefs ?? []) defMap[d.id] = { name: d.name, image_url: d.image_url, metadata: d.metadata ?? {} }

    const groups: Record<string, DraftCard> = {}
    for (const c of rawCards ?? []) {
      if (!groups[c.card_id]) {
        const def = defMap[c.card_id]
        const combat = (def?.metadata?.combat ?? c.metadata?.combat ?? { atk: 1, hp: 2, cost: 1 }) as { atk: number; hp: number; cost: number }
        groups[c.card_id] = {
          card_id:    c.card_id,
          rarity:     c.rarity,
          family:     c.family,
          name:       def?.name ?? c.card_id,
          image_url:  def?.image_url ?? null,
          ownedCount: 0,
          atk:        combat.atk ?? 1,
          hp:         combat.hp ?? 2,
          cost:       combat.cost ?? 1,
        }
      }
      groups[c.card_id].ownedCount++
    }

    const sorted = Object.values(groups).sort((a, b) => {
      const ri = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
      return ri !== 0 ? ri : a.name.localeCompare(b.name)
    })

    setCards(sorted)
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const totalCards = selected.reduce((s, e) => s + e.qty, 0)
  const totalMana  = selected.reduce((s, e) => s + e.card.cost * e.qty, 0)
  const manaOver   = totalMana > MANA_BUDGET

  function getQty(card_id: string) {
    return selected.find(e => e.card.card_id === card_id)?.qty ?? 0
  }

  function canAdd(card: DraftCard): { ok: boolean; reason?: string } {
    if (totalCards >= DECK_SIZE)       return { ok: false, reason: 'Deck plein' }
    if (manaOver)                      return { ok: false, reason: 'Budget mana dépassé' }
    const qty = getQty(card.card_id)
    const max = Math.min(MAX_COPIES[card.rarity] ?? 1, card.ownedCount)
    if (qty >= max)                    return { ok: false, reason: `Max ${max} exemplaire(s) pour cette rareté` }
    if (totalMana + card.cost > MANA_BUDGET) return { ok: false, reason: 'Ajout dépasserait le budget mana' }
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

  function handleQueue() {
    if (totalCards < DECK_SIZE || manaOver) return
    const deck: unknown[] = []
    for (const { card, qty } of selected) {
      for (let i = 0; i < qty; i++) {
        deck.push({
          id: `${card.card_id}_${i}`, name: card.name, rarity: card.rarity,
          family: card.family, qty: 1,
          metadata: { combat: { atk: card.atk, hp: card.hp, cost: card.cost, effects: [] } },
        })
      }
    }
    sessionStorage.setItem('draft_deck', JSON.stringify(deck))
    router.push(isFriendly ? '/combat/matchmaking?mode=friendly' : '/combat/matchmaking')
  }

  const filtered  = filter === 'all' ? cards : cards.filter(c => c.rarity === filter)
  const rarities  = RARITY_ORDER.filter(r => cards.some(c => c.rarity === r))
  const manaRatio = Math.min(1, totalMana / MANA_BUDGET)
  const ready     = totalCards === DECK_SIZE && !manaOver

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#030308]/90 backdrop-blur-md pt-3 pb-3 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors">
            <ArrowLeft size={16} /> Retour
          </button>
          <button onClick={handleQueue} disabled={!ready}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
              ready ? 'bg-[#7b2bff] text-white hover:bg-[#6920e0]' : 'bg-white/5 text-white/20 cursor-not-allowed'
            )}>
            <Swords size={13} /> Chercher un match
          </button>
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
          {/* Cartes */}
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
          {/* Mana */}
          <div className="flex-1">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-white/40 font-bold flex items-center gap-1"><Zap size={9} /> BUDGET</span>
              <span className={cn('font-bold', manaOver ? 'text-red-400' : totalMana > MANA_BUDGET * 0.85 ? 'text-[#ff9a3d]' : 'text-white/60')}>
                {totalMana}/{MANA_BUDGET}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${manaRatio * 100}%`,
                  background: manaOver ? '#ef4444' : totalMana > MANA_BUDGET * 0.85 ? '#ff9a3d' : '#4aa3ff',
                }} />
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

        {/* Filtres */}
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
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2">Deck sélectionné</p>
          <div className="flex flex-wrap gap-1.5">
            {selected.map(({ card, qty }) => (
              <div key={card.card_id} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10"
                style={{ background: RARITY_COLOR[card.rarity] + '15' }}>
                <span className="text-[10px] font-bold" style={{ color: RARITY_COLOR[card.rarity] }}>{card.name}</span>
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
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
          {filtered.map(card => {
            const qty    = getQty(card.card_id)
            const max    = Math.min(MAX_COPIES[card.rarity] ?? 1, card.ownedCount)
            const { ok, reason } = canAdd(card)
            const atMax  = qty >= max

            return (
              <div key={card.card_id} className="relative">
                <button onClick={() => add(card)} disabled={!ok}
                  className={cn(
                    'relative w-full rounded-xl overflow-hidden border-2 transition-all',
                    qty > 0 ? 'border-[#7b2bff]' : 'border-transparent',
                    !ok ? 'opacity-40 cursor-not-allowed' : 'hover:border-white/20'
                  )}
                  title={!ok ? reason : undefined}>

                  {/* Artwork */}
                  <div className="aspect-[0.714] relative" style={{ background: RARITY_BG[card.rarity] }}>
                    {card.image_url ? (
                      <Image src={card.image_url} alt={card.name} fill className="object-contain" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full opacity-30"
                          style={{ background: `radial-gradient(circle, ${RARITY_COLOR[card.rarity]}, transparent)` }} />
                      </div>
                    )}

                    {/* Badge qty */}
                    {qty > 0 && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#7b2bff] flex items-center justify-center text-[9px] font-black text-white">
                        {qty}
                      </div>
                    )}

                    {/* Coût mana */}
                    <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-[#4aa3ff]/80 flex items-center justify-center text-[9px] font-black text-white">
                      {card.cost}
                    </div>

                    {/* Stats */}
                    <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1.5 pb-1">
                      <span className="text-[8px] font-black text-[#ff6b6b] bg-black/60 rounded px-0.5">{card.atk}⚔</span>
                      <span className="text-[8px] font-black text-[#00c896] bg-black/60 rounded px-0.5">{card.hp}♥</span>
                    </div>
                  </div>

                  {/* Nom + max exemplaires possédés */}
                  <div className="px-1.5 py-1 bg-black/40">
                    <p className="text-[9px] font-bold text-white truncate">{card.name}</p>
                    <p className="text-[8px] text-white/30">{qty}/{max} · {card.ownedCount} possédées</p>
                  </div>
                </button>

                {/* Bouton retirer */}
                {qty > 0 && (
                  <button onClick={() => remove(card.card_id)}
                    className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center hover:bg-red-500 transition-colors z-10">
                    <X size={8} className="text-white" />
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
