'use client'
import { useState, useEffect } from 'react'
import { CardHover } from '@/components/game/CardHover'
import { CardFrame } from '@/components/game/CardFrame'
import { CardMedia } from '@/components/game/CardMedia'
import { Star, X, Check, Pencil } from 'lucide-react'

const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#ec4899',
  rare: '#4aa3ff', uncommon: '#22c55e', common: '#9ca3af',
}
const RARITY_ORDER = ['void', 'legendary', 'epic', 'rare', 'uncommon', 'common']
const MAX_FAV = 3

type CardDef = { id: string; name: string; rarity: string; image_url: string | null }

export function FavoriteShowcase({
  favoriteIds,
  editable = false,
  ownedIds = [],
  onSave,
  onCardClick,
  className = ''
}: {
  favoriteIds: string[]
  editable?: boolean
  ownedIds?: string[]
  onSave?: (ids: string[]) => void | Promise<void>
  onCardClick?: (def: CardDef) => void
  className?: string
}) {
  const [defs, setDefs] = useState<Record<string, CardDef>>({})
  const [picker, setPicker] = useState(false)
  const [draft, setDraft] = useState<string[]>(favoriteIds)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setDraft(favoriteIds) }, [favoriteIds.join(',')]) // eslint-disable-line

  useEffect(() => {
    fetch('/api/cards')
      .then(r => (r.ok ? r.json() : []))
      .then((cards: Array<Record<string, unknown>>) => {
        const m: Record<string, CardDef> = {}
        for (const d of cards) {
          const id = d.id as string
          m[id] = {
            id,
            name: (d.name as string) ?? id,
            rarity: (d.rarity as string) ?? 'common',
            image_url: (d.imageUrl ?? d.image_url ?? null) as string | null,
          }
        }
        setDefs(m)
      })
      .catch(() => {})
  }, [])

  const favCards = favoriteIds.map(id => defs[id]).filter(Boolean) as CardDef[]

  function toggleDraft(id: string) {
    setDraft(d =>
      d.includes(id) ? d.filter(x => x !== id) : d.length < MAX_FAV ? [...d, id] : d,
    )
  }

  async function save() {
    setSaving(true)
    await onSave?.(draft)
    setSaving(false)
    setPicker(false)
  }

  const ownedDefs = (ownedIds.map(id => defs[id]).filter(Boolean) as CardDef[]).sort(
    (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity),
  )

  function renderCard(def: CardDef) {
    return (
      <CardHover rarity={def.rarity} className="relative" style={{ aspectRatio: '0.714' }}>
        <CardFrame rarity={def.rarity} name={def.name} glow={false} hideStats style={{ position: 'absolute', inset: 0 }}>
          {def.image_url ? (
            <CardMedia src={def.image_url} alt={def.name} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-10 h-10 rounded-full opacity-30" style={{ background: `radial-gradient(circle, ${RARITY_COLOR[def.rarity]}, transparent)` }} />
            </div>
          )}
        </CardFrame>
      </CardHover>
    )
  }

  return (
    <div className={`rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Star size={15} className="text-[#a855f7]" />
          <h3 className="text-white font-bold text-sm">Vitrine</h3>
        </div>
        {editable && (
          <button
            onClick={() => { setDraft(favoriteIds); setPicker(true) }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors"
          >
            <Pencil size={11} /> Éditer
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map(i => {
          const def = favCards[i]
          if (def) return (
            <div key={def.id} onClick={() => onCardClick?.(def)}
              className={onCardClick ? 'cursor-pointer active:scale-95 transition-transform' : ''}>
              {renderCard(def)}
            </div>
          )
          return (
            <button
              key={`empty-${i}`}
              onClick={editable ? () => { setDraft(favoriteIds); setPicker(true) } : undefined}
              className="rounded-[12px] border-2 border-dashed border-white/10 flex items-center justify-center text-white/25 disabled:cursor-default"
              disabled={!editable}
              style={{ aspectRatio: '0.714' }}
            >
              {editable ? <Star size={20} /> : null}
            </button>
          )
        })}
      </div>

      {/* Picker */}
      {editable && picker && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4"
          onClick={() => setPicker(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full sm:w-[460px] max-h-[80vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[#0b0a14] border border-white/10 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div>
                <p className="text-white font-bold text-sm">Choisis tes favorites</p>
                <p className="text-white/40 text-xs">{draft.length}/{MAX_FAV} sélectionnées</p>
              </div>
              <button onClick={() => setPicker(false)} className="text-white/50 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {ownedDefs.length === 0 ? (
                <p className="text-white/40 text-sm text-center py-10">Aucune carte possédée pour le moment.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {ownedDefs.map(def => {
                    const sel = draft.includes(def.id)
                    return (
                      <button
                        key={def.id}
                        onClick={() => toggleDraft(def.id)}
                        className="relative rounded-[10px] transition-transform active:scale-95"
                        style={{ aspectRatio: '0.714', outline: sel ? `2px solid ${RARITY_COLOR[def.rarity]}` : 'none', outlineOffset: 2 }}
                      >
                        <div className="absolute inset-0 rounded-[10px] overflow-hidden border border-white/10">
                          {def.image_url ? (
                            <CardMedia src={def.image_url} alt={def.name} />
                          ) : (
                            <div className="w-full h-full bg-white/5" />
                          )}
                        </div>
                        {sel && (
                          <div
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: RARITY_COLOR[def.rarity] }}
                          >
                            <Check size={12} className="text-black" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-white/10 flex justify-end gap-2">
              <button onClick={() => setPicker(false)} className="px-4 py-2 rounded-xl text-white/60 text-sm font-bold hover:bg-white/5">
                Annuler
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}
              >
                {saving ? '…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
