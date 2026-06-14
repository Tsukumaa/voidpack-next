'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Swords, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useGameStore } from '@/store/game'
import { cn } from '@/lib/utils'

const DECK_SIZE = 15
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
  count: number
  atk: number
  hp: number
  cost: number
}

export default function DraftPage() {
  const router = useRouter()
  const { user } = useGameStore(s => ({ user: s.user }))
  const [cards, setCards]       = useState<DraftCard[]>([])
  const [selected, setSelected] = useState<DraftCard[]>([])
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
          card_id:   c.card_id,
          rarity:    c.rarity,
          family:    c.family,
          name:      def?.name ?? c.card_id,
          image_url: def?.image_url ?? null,
          count:     0,
          atk:       combat.atk ?? 1,
          hp:        combat.hp ?? 2,
          cost:      combat.cost ?? 1,
        }
      }
      groups[c.card_id].count++
    }

    const sorted = Object.values(groups).sort((a, b) => {
      const ri = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
      return ri !== 0 ? ri : a.name.localeCompare(b.name)
    })

    setCards(sorted)
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  function toggle(card: DraftCard) {
    setSelected(prev => {
      const already = prev.find(c => c.card_id === card.card_id)
      if (already) return prev.filter(c => c.card_id !== card.card_id)
      if (prev.length >= DECK_SIZE) return prev
      return [...prev, card]
    })
  }

  function handleQueue() {
    if (selected.length < DECK_SIZE) return
    const deck = selected.map(c => ({
      id: c.card_id, name: c.name, rarity: c.rarity,
      family: c.family, qty: 1,
      metadata: { combat: { atk: c.atk, hp: c.hp, cost: c.cost, effects: [] } },
    }))
    sessionStorage.setItem('draft_deck', JSON.stringify(deck))
    router.push('/combat/matchmaking')
  }

  const filtered = filter === 'all' ? cards : cards.filter(c => c.rarity === filter)
  const rarities = RARITY_ORDER.filter(r => cards.some(c => c.rarity === r))

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#030308]/90 backdrop-blur-md pt-3 pb-2 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors">
            <ArrowLeft size={16} /> Retour
          </button>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-bold', selected.length === DECK_SIZE ? 'text-[#00c896]' : 'text-white/40')}>
              {selected.length}/{DECK_SIZE} cartes
            </span>
            <button
              onClick={handleQueue}
              disabled={selected.length < DECK_SIZE}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                selected.length === DECK_SIZE
                  ? 'bg-[#7b2bff] text-white hover:bg-[#6920e0]'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'
              )}>
              <Swords size={13} /> Chercher un match
            </button>
          </div>
        </div>

        <h2 className="font-bold text-white text-base mb-3">Construction du deck</h2>

        {/* Filtres rareté */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button onClick={() => setFilter('all')}
            className={cn('px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all',
              filter === 'all' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/60')}>
            Tout
          </button>
          {rarities.map(r => (
            <button key={r} onClick={() => setFilter(filter === r ? 'all' : r)}
              className={cn('px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all capitalize',
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
            {selected.map(c => (
              <button key={c.card_id} onClick={() => toggle(c)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border border-white/10 hover:border-red-500/40 group transition-colors"
                style={{ background: RARITY_COLOR[c.rarity] + '15', color: RARITY_COLOR[c.rarity] }}>
                {c.name}
                <X size={9} className="opacity-0 group-hover:opacity-100 text-red-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grille cartes */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/30 text-sm">Chargement…</div>
      ) : cards.length === 0 ? (
        <div className="text-center py-20 text-white/30 text-sm">Aucune carte dans ta collection.</div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
          {filtered.map(card => {
            const isSelected = !!selected.find(c => c.card_id === card.card_id)
            const isFull = selected.length >= DECK_SIZE && !isSelected
            return (
              <button
                key={card.card_id}
                onClick={() => toggle(card)}
                disabled={isFull}
                className={cn(
                  'relative rounded-xl overflow-hidden border-2 transition-all',
                  isSelected ? 'border-[#7b2bff] scale-[0.97]' : 'border-transparent',
                  isFull ? 'opacity-30 cursor-not-allowed' : 'hover:border-white/20'
                )}>

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
                  {isSelected && (
                    <div className="absolute inset-0 bg-[#7b2bff]/20 flex items-center justify-center">
                      <div className="w-7 h-7 rounded-full bg-[#7b2bff] flex items-center justify-center">
                        <Check size={14} className="text-white" />
                      </div>
                    </div>
                  )}
                  {/* Stats combat */}
                  <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1.5 pb-1">
                    <span className="text-[9px] font-black text-[#ff6b6b] bg-black/60 rounded px-1">{card.atk}⚔</span>
                    <span className="text-[9px] font-black text-[#00c896] bg-black/60 rounded px-1">{card.hp}♥</span>
                  </div>
                  {/* Coût mana */}
                  <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-[#4aa3ff]/80 flex items-center justify-center text-[9px] font-black text-white">
                    {card.cost}
                  </div>
                </div>

                {/* Nom */}
                <div className="px-1.5 py-1 bg-black/40">
                  <p className="text-[9px] font-bold text-white truncate">{card.name}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
