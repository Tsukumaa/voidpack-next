'use client'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { ChevronDown, Lock } from 'lucide-react'
import { useGameStore } from '@/store/game'
import { cn } from '@/lib/utils'
import { CardModal } from '@/components/game/CardModal'
import { CardHover } from '@/components/game/CardHover'
import { CardFrame } from '@/components/game/CardFrame'

const RARITY_ORDER = ['void','legendary','epic','rare','uncommon','common']
const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#ec4899',
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

interface PlayerCard {
  id: string
  card_id: string
  rarity: string
  family: string
  obtained_at: string
  metadata: {
    name?: string
    image?: string
    image_url?: string
  }
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
}

export default function CollectionPage() {
  const { user } = useGameStore(s => ({ user: s.user }))
  const [cards, setCards]         = useState<GroupedCard[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<string>('all')
  const [families, setFamilies]   = useState<{ key: string; label: string }[]>([])
  const [selected, setSelected]   = useState<GroupedCard | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleSection = (r: string) => setCollapsed(prev => ({ ...prev, [r]: !prev[r] }))

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [rawCards, cardDefs, famData] = await Promise.all([
      fetch('/api/collection').then(r => r.ok ? r.json() : []),
      fetch('/api/cards').then(r => r.ok ? r.json() : []),
      fetch('/api/families').then(r => r.ok ? r.json() : []),
    ])

    const defMap: Record<string, { name: string; image_url: string | null; description: string | null; cost: number | null; atk: number | null; def: number | null }> = {}
    for (const d of cardDefs ?? []) {
      const meta = typeof d.metadata === 'string' ? (() => { try { return JSON.parse(d.metadata || '{}') } catch { return {} } })() : (d.metadata ?? {})
      defMap[d.id] = {
        name: d.name,
        image_url: d.imageUrl ?? d.image_url,
        description: d.description ?? null,
        cost: meta?.combat?.cost ?? null,
        atk:  meta?.combat?.atk  ?? null,
        def:  meta?.combat?.hp   ?? null,
      }
    }

    const ownedList: GroupedCard[] = (rawCards ?? []).map((c: { card_id?: string; cardId?: string; rarity: string; family: string; count?: number; last_obtained_at?: string }) => {
      const cardKey = c.card_id ?? c.cardId ?? ''
      const def = defMap[cardKey]
      return {
        card_id:     cardKey,
        rarity:      c.rarity,
        family:      c.family,
        count:       c.count ?? 1,
        name:        def?.name ?? cardKey,
        image_url:   def?.image_url ?? null,
        description: def?.description ?? null,
        latest_at:   c.last_obtained_at ?? '',
        cost:        def?.cost ?? null,
        atk:         def?.atk  ?? null,
        def:         def?.def  ?? null,
        owned:       true,
      }
    })

    // Cartes non possédées → placeholders verrouillés
    const ownedIds = new Set(ownedList.map(c => c.card_id))
    const lockedList: GroupedCard[] = (cardDefs ?? [])
      .filter((d: { id: string }) => !ownedIds.has(d.id))
      .map((d: { id: string; name?: string; rarity?: string; family?: string; familyKey?: string }) => {
        const def = defMap[d.id]
        return {
          card_id:     d.id,
          rarity:      d.rarity ?? 'common',
          family:      d.family ?? d.familyKey ?? '',
          count:       0,
          name:        def?.name ?? d.name ?? d.id,
          image_url:   def?.image_url ?? null,
          description: def?.description ?? null,
          latest_at:   '',
          cost:        def?.cost ?? null,
          atk:         def?.atk  ?? null,
          def:         def?.def  ?? null,
          owned:       false,
        }
      })

    const sorted = [...ownedList, ...lockedList].sort((a, b) => {
      const ri = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
      return ri !== 0 ? ri : a.name.localeCompare(b.name)
    })

    setCards(sorted)
    setFamilies(famData)
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const filtered = filter === 'all' ? cards : cards.filter(c => c.rarity === filter || c.family === filter)

  const rarityGroups = RARITY_ORDER.filter(r => filtered.some(c => c.rarity === r))

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="sticky top-20 z-20 py-4 mb-5 backdrop-blur-md flex flex-col justify-center rounded-xl">
        <div className="flex items-center justify-center gap-3 mb-3">
          <h2 className="font-bold text-white text-base">Ma collection</h2>
          <span className="text-white/40 text-xs">{cards.filter(c => c.owned).length} / {cards.length} cartes · {cards.reduce((a, c) => a + c.count, 0)} copies</span>
        </div>

        {/* Filtres */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide justify-center">
          <button onClick={() => setFilter('all')}
            className={cn('px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all',
              filter === 'all' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/60')}>
            Tout
          </button>
          {RARITY_ORDER.filter(r => cards.some(c => c.rarity === r)).map(r => (
            <button key={r} onClick={() => setFilter(filter === r ? 'all' : r)}
              className={cn('px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all capitalize',
                filter === r ? 'text-white' : 'text-white/40 hover:text-white/60')}
              style={filter === r ? { background: RARITY_COLOR[r] + '30', color: RARITY_COLOR[r] } : {}}>
              {r}
            </button>
          ))}
          {families.map(f => (
            <button key={f.key} onClick={() => setFilter(filter === f.key ? 'all' : f.key)}
              className={cn('px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all',
                filter === f.key ? 'bg-[#7b2bff]/30 text-[#a78bfa]' : 'text-white/40 hover:text-white/60')}>
              {f.label}
            </button>
          ))}
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
                <button onClick={() => toggleSection(r)}
                  className="flex items-center gap-2 mb-3 w-full">
                  <ChevronDown size={14} className="transition-transform duration-300 shrink-0"
                    style={{ color: RARITY_COLOR[r], transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: RARITY_COLOR[r] }}>{r}</span>
                  <div className="flex-1 h-px" style={{ background: RARITY_COLOR[r] + '30' }} />
                  <span className="text-white/30 text-xs">{group.length}</span>
                </button>
                <div className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}>
                  <div className="overflow-hidden">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4">
                      {group.map(card => (
                    !card.owned ? (
                      <div
                        key={card.card_id}
                        className="relative rounded-[12px] overflow-hidden border border-white/[0.06] bg-black/40"
                        style={{ aspectRatio: '0.714' }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/assets/dos.png" alt="" draggable={false}
                          className="w-full h-full object-cover select-none"
                          style={{ filter: 'grayscale(1) brightness(0.32) contrast(0.9)' }} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                          <Lock size={24} className="text-white/45" />
                          <span className="text-white/30 text-[9px] font-bold uppercase tracking-widest">Verrouillée</span>
                        </div>
                      </div>
                    ) : (
                    <CardHover
                      key={card.card_id}
                      rarity={card.rarity}
                      className="relative cursor-pointer active:scale-95"
                      style={{ aspectRatio: '0.714' }}
                    >
                      <CardFrame
                        rarity={card.rarity}
                        name={card.name}
                        cost={card.cost}
                        atk={card.atk}
                        def={card.def}
                        glow={false}
                        style={{ position: 'absolute', inset: 0 }}
                      >
                        <button onClick={() => setSelected(card)} className="absolute inset-0 w-full h-full">
                          {card.image_url ? (
                            <Image src={card.image_url} alt={card.name} fill className="object-cover" unoptimized />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-12 h-12 rounded-full opacity-30"
                                style={{ background: `radial-gradient(circle, ${RARITY_COLOR[card.rarity]}, transparent)` }} />
                            </div>
                          )}
                        </button>
                        {card.count > 1 && (
                          <div className="absolute top-6 right-1.5 w-5 h-5 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-[10px] font-bold text-white z-20">
                            {card.count}
                          </div>
                        )}
                      </CardFrame>
                    </CardHover>
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

      {/* Modal detail carte */}
      {selected && (
        <CardModal
          name={selected.name}
          rarity={selected.rarity}
          family={selected.family}
          artUrl={selected.image_url}
          description={selected.description}
          count={selected.count}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
