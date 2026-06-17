'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown, Lock } from 'lucide-react'
import { CardMedia } from '@/components/game/CardMedia'
import { useGameStore } from '@/store/game'
import { cn } from '@/lib/utils'
import { CardModal } from '@/components/game/CardModal'
import { CardHover } from '@/components/game/CardHover'
import { CardFrame } from '@/components/game/CardFrame'

const RARITY_ORDER = ['void','legendary','epic','rare','common']
const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#ec4899',
  rare: '#4aa3ff', common: '#9ca3af',
}
// Taux d'apparition par rareté (cf. RARITY_WEIGHTS dans /api/booster/open, somme = 100)
const RARITY_RATES: Record<string, number> = {
  common: 85, rare: 10, epic: 4, legendary: 0.8, void: 0.2,
}
const RARITY_BG: Record<string, string> = {
  void:      'linear-gradient(135deg, #1a0a3a, #0d051f)',
  legendary: 'linear-gradient(135deg, #2a1500, #110800)',
  epic:      'linear-gradient(135deg, #1a0a2e, #0a0518)',
  rare:      'linear-gradient(135deg, #0a1628, #04080f)',
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
  artist: string | null
  artistUrl: string | null
}

export default function CollectionPage() {
  const { user } = useGameStore(s => ({ user: s.user }))
  const [cards, setCards]         = useState<GroupedCard[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<string>('all')
  const [families, setFamilies]   = useState<{ key: string; label: string }[]>([])
  const [selected, setSelected]   = useState<GroupedCard | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [famOpen, setFamOpen]     = useState(false)
  const [showRates, setShowRates] = useState(false)
  const famRef                    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (famRef.current && !famRef.current.contains(e.target as Node)) setFamOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const toggleSection = (r: string) => setCollapsed(prev => ({ ...prev, [r]: !prev[r] }))

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [rawCards, cardDefs, famData] = await Promise.all([
      fetch('/api/collection').then(r => r.ok ? r.json() : []),
      fetch('/api/cards').then(r => r.ok ? r.json() : []),
      fetch('/api/families').then(r => r.ok ? r.json() : []),
    ])

    const defMap: Record<string, { name: string; image_url: string | null; description: string | null; cost: number | null; atk: number | null; def: number | null; artist: string | null; artistUrl: string | null }> = {}
    for (const d of cardDefs ?? []) {
      const meta = typeof d.metadata === 'string' ? (() => { try { return JSON.parse(d.metadata || '{}') } catch { return {} } })() : (d.metadata ?? {})
      defMap[d.id] = {
        name: d.name,
        image_url: d.imageUrl ?? d.image_url,
        description: d.description ?? null,
        cost: meta?.combat?.cost ?? null,
        atk:  meta?.combat?.atk  ?? null,
        def:  meta?.combat?.hp   ?? null,
        artist: d.artist ?? null,
        artistUrl: d.artistUrl ?? d.artist_url ?? null,
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
        artist: def?.artist ?? null,
        artistUrl: def?.artistUrl ?? null,
      }
    })

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
          artist: def?.artist ?? null,
          artistUrl: def?.artistUrl ?? null,
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
      <div className="sticky top-20 z-20 py-4 mb-10 backdrop-blur-md flex flex-col justify-center rounded-xl" style={{ backgroundColor: 'rgba(8,10,18,0.82)' }}>
        <div className="flex items-center justify-center gap-3 mb-3">
          <h2 className="font-bold text-white text-base">Ma collection</h2>
          <span className="text-white/40 text-xs">{cards.filter(c => c.owned).length} / {cards.length} cartes · {cards.reduce((a, c) => a + c.count, 0)} copies</span>
        </div>

        {/* Filtres */}
        <div className="flex items-center justify-center gap-2 px-4">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide min-w-0">
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
          </div>

          {families.length > 0 && (
            <>
              <div className="w-px h-4 bg-white/10 shrink-0" />
              <div ref={famRef} className="relative shrink-0">
                <button
                  onClick={() => setFamOpen(v => !v)}
                  className={cn('flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all',
                    families.some(f => f.key === filter) ? 'text-[#a78bfa]' : 'text-white/40 hover:text-white/60')}
                  style={families.some(f => f.key === filter) ? { background:'rgba(123,43,255,0.2)', border:'1px solid rgba(123,43,255,0.4)' } : { border:'1px solid rgba(255,255,255,0.08)' }}
                >
                  {families.find(f => f.key === filter)?.label ?? 'Famille'}
                  <ChevronDown size={11} className={cn('transition-transform', famOpen && 'rotate-180')} />
                </button>
                {famOpen && (
                  <div className="absolute top-full mt-1 right-0 z-50 min-w-[140px] rounded-xl overflow-hidden"
                    style={{ background:'#0d0d1a', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 8px 32px rgba(0,0,0,0.6)' }}>
                    {families.some(f => f.key === filter) && (
                      <button onClick={() => { setFilter('all'); setFamOpen(false) }}
                        className="w-full text-left px-4 py-2 text-xs text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors">
                        Toutes les familles
                      </button>
                    )}
                    {families.map(f => (
                      <button key={f.key}
                        onClick={() => { setFilter(f.key); setFamOpen(false) }}
                        className={cn('w-full text-left px-4 py-2 text-xs font-bold transition-colors',
                          filter === f.key ? 'text-[#a78bfa] bg-[#7b2bff]/15' : 'text-white/60 hover:text-white hover:bg-white/5')}>
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
            onMouseEnter={() => setShowRates(true)}
            onMouseLeave={() => setShowRates(false)}>
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-5">
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
                          <Lock size={24} className="text-white/50" />
                          <span className="text-white/50 text-[9px] font-bold uppercase tracking-widest">Pas encore découverte</span>
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

      {selected && (
        <CardModal
          name={selected.name}
          rarity={selected.rarity}
          family={selected.family}
          artUrl={selected.image_url}
          description={selected.description}
          count={selected.count}
          artist={selected.artist}
          artistUrl={selected.artistUrl}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
