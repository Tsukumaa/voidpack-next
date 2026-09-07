'use client'
import { Check, Palette, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useGameStore } from '@/store/game'
import { CardBackDisplay } from '@/components/game/CardBackDisplay'

interface CardBack { id: string; name: string; gradient: string; pattern: string; imageUrl?: string | null; image_url?: string | null }
interface Arena { id: string; name: string; imageUrl?: string | null; image_url?: string | null; gradient?: string | null }

export function ShopModal({ onClose }: { onClose: () => void }) {
  const { profile, setProfile } = useGameStore(s => ({ profile: s.profile, setProfile: s.setProfile }))
  const [cardBacks, setCardBacks] = useState<CardBack[]>([])
  const [arenas, setArenas]       = useState<Arena[]>([])
  const [selectedArena, setSelectedArena] = useState<string>('default')
  const [loading, setLoading]     = useState(true)

  const selected = profile?.selected_card_back ?? 'default'

  useEffect(() => {
    fetch('/api/card-backs')
      .then(r => r.json())
      .then(data => { setCardBacks(data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
    fetch('/api/arenas').then(r => r.json()).then(d => setArenas(d ?? [])).catch(() => {})
    fetch('/api/profile/arena').then(r => r.json()).then(d => setSelectedArena(d?.arenaId ?? 'default')).catch(() => {})
  }, [])

  async function selectArena(id: string) {
    setSelectedArena(id)
    await fetch('/api/profile/arena', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arenaId: id }),
    })
  }

  async function selectBack(id: string) {
    if (!profile) return
    setProfile({ ...profile, selected_card_back: id })
    await fetch('/api/profile/card-back', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardBackId: id }),
    })
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full sm:w-[680px] lg:w-[820px] h-[92vh] sm:h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#0a0612] border border-white/10 overflow-hidden">

        <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2"><Palette size={18} /> Personnalisation</h2>
            <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
          </div>
          <p className="text-white/40 text-xs font-bold uppercase tracking-wider">Dos de carte</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {loading ? (
              <div className="col-span-4 text-center text-white/30 text-sm py-8">Chargement…</div>
            ) : cardBacks.map(skin => {
              const isSelected = selected === skin.id
              return (
                <div key={skin.id} className="rounded-2xl overflow-hidden border cursor-pointer"
                  style={{
                    borderColor: isSelected ? '#7b2bff' : 'rgba(255,255,255,0.08)',
                    borderWidth: isSelected ? '2px' : '1px',
                  }}
                  onClick={() => selectBack(skin.id)}>
                  <div className="aspect-[0.714] relative overflow-hidden">
                    <CardBackDisplay gradient={skin.gradient} pattern={skin.pattern} imageUrl={skin.imageUrl ?? skin.image_url} />
                    {!(skin.imageUrl ?? skin.image_url) && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full border-2 border-white/30 flex items-center justify-center">
                          <div className="w-4 h-4 rounded-full bg-white/40" />
                        </div>
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-[#7b2bff] flex items-center justify-center"><Check size={12} className="text-white" /></div>
                    )}
                  </div>
                  <div className="p-2.5 bg-white/[0.03]">
                    <p className="text-white text-xs font-bold">{skin.name}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-white/40 text-xs font-bold uppercase tracking-wider mt-7 mb-3">
            Fonds d&apos;arène — change le décor de tes combats
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {arenas.map(arena => {
              const img = arena.imageUrl ?? arena.image_url
              const isSel = selectedArena === arena.id
              return (
                <div key={arena.id} className="rounded-2xl overflow-hidden border cursor-pointer"
                  style={{ borderColor: isSel ? '#7b2bff' : 'rgba(255,255,255,0.08)', borderWidth: isSel ? '2px' : '1px' }}
                  onClick={() => selectArena(arena.id)}>
                  <div className="aspect-[16/9] relative overflow-hidden"
                    style={{ background: arena.gradient ?? '#08031a' }}>
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={arena.name} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                    )}
                    {isSel && (
                      <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-[#7b2bff] flex items-center justify-center"><Check size={12} className="text-white" /></div>
                    )}
                  </div>
                  <div className="p-2.5 bg-white/[0.03]">
                    <p className="text-white text-xs font-bold">{arena.name}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
