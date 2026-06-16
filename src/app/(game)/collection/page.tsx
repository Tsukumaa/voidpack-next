'use client'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useGameStore } from '@/store/game'
import { cn } from '@/lib/utils'
import { CardModal } from '@/components/game/CardModal'
import { CardHover } from '@/components/game/CardHover'
import { CardFrame } from '@/components/game/CardFrame'

const RARITY_ORDER = ['void','legendary','epic','rare','uncommon','common']
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
}

export default function CollectionPage() {
  const { user } = useGameStore(s => ({ user: s.user }))
  const [cards, setCards]         = useState<GroupedCard[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<string>('all')
  const [families, setFamilies]   = useState<{ key: string; label: string }[]>([])
  const [selected, setSelected]   = useState<GroupedCard | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [rawCards, cardDefs] = await Promise.all([
      fetch('/api/collection').then(r => r.ok ? r.json() : []),
      fetch('/api/cards').then(r => r.ok ? r.json() : []),
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

    // Grouper par card_id
    const groups: Record<string, GroupedCard> = {}
    for (const c of rawCards ?? []) {
      const cardKey = c.card_id ?? c.cardId
      const meta = typeof c.metadata === 'string' ? (() => { try { return JSON.parse(c.metadata || '{}') } catch { return {} } })() : (c.metadata ?? {})
      if (!groups[cardKey]) {
        const def = defMap[cardKey]
        groups[cardKey] = {
          card_id: cardKey,
          rarity: c.rarity,
          family: c.family,
          count: 0,
          name: def?.name ?? meta?.name ?? cardKey,
          image_url: def?.image_url ?? meta?.image ?? null,
          description: def?.description ?? null,
          latest_at: c.obtained_at ?? c.obtainedAt,
          cost: def?.cost ?? null,
          atk:  def?.atk  ?? null,
          def:  def?.def  ?? null,
        }
      }
      groups[cardKey].count++
    }

    // Trier par rareté puis nom
    const sorted = Object.values(groups).sort((a, b) => {
      const ri = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
      if (ri !== 0) return ri
      return a.name.localeCompare(b.name)
    })

    setCards(sorted)

    // Familles disponibles
    const famRes = await fetch('/api/families')
    const famData = famRes.ok ? await famRes.json() : []
    setFamilies(famData)

    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const filtered = filter === 'all' ? cards : cards.filter(c => c.rarity === filter || c.family === filter)

  const rarityGroups = RARITY_ORDER.filter(r => filtered.some(c => c.rarity === r))

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#030308]/90 backdrop-blur-md pt-3 pb-2 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-white text-base">Ma collection</h2>
          <span className="text-white/40 text-xs">{cards.length} cartes · {Object.values(cards).reduce((a, c) => a + c.count, 0)} copies</span>
        </div>

        {/* Filtres */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
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
            return (
              <div key={r}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: RARITY_COLOR[r] }}>{r}</span>
                  <div className="flex-1 h-px" style={{ background: RARITY_COLOR[r] + '30' }} />
                  <span className="text-white/30 text-xs">{group.length}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {group.map(card => (
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
                  ))}
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
