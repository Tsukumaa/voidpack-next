'use client'
import Image from 'next/image'
import { CardHover } from '@/components/game/CardHover'

const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#b86dff',
  rare: '#4aa3ff', uncommon: '#22c55e', common: '#9ca3af',
}
const RARITY_BG: Record<string, string> = {
  void:      'radial-gradient(ellipse at 50% 0%, #1a0a3a 0%, #050210 60%, #000 100%)',
  legendary: 'radial-gradient(ellipse at 50% 0%, #2a1800 0%, #100800 60%, #000 100%)',
  epic:      'radial-gradient(ellipse at 50% 0%, #1a0a2e 0%, #0a0518 60%, #000 100%)',
  rare:      'radial-gradient(ellipse at 50% 0%, #0a1628 0%, #040810 60%, #000 100%)',
  uncommon:  'radial-gradient(ellipse at 50% 0%, #0a1f10 0%, #040a06 60%, #000 100%)',
  common:    'radial-gradient(ellipse at 50% 0%, #111118 0%, #060608 60%, #000 100%)',
}

function hexToRgba(hex: string, a: number) {
  const v = hex.replace('#','')
  const b = parseInt(v.length===3?v.split('').map(c=>c+c).join(''):v,16)
  return `rgba(${(b>>16)&255},${(b>>8)&255},${b&255},${a})`
}

interface CardModalProps {
  name: string
  rarity: string
  family?: string
  artUrl?: string | null
  description?: string | null
  count?: number
  onClose: () => void
}

function parseDescription(desc: string) {
  const artistMatch = desc.match(/artiste?\s*:?\s*([^\[\n]+)(?:\[([^\]]+)\])?/i)
  const cleanDesc = desc.replace(/artiste?\s*:?[^\n]*/i, '').trim()
  return {
    text: cleanDesc || null,
    artistName: artistMatch?.[1]?.trim() || null,
    artistUrl: artistMatch?.[2]?.trim() || null,
  }
}

export function CardModal({ name, rarity, family, artUrl, description, count, onClose }: CardModalProps) {
  const color = RARITY_COLOR[rarity] ?? '#9ca3af'
  const parsed = description ? parseDescription(description) : null

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="flex flex-col items-center gap-4 w-full max-w-[320px]"
        onClick={e => e.stopPropagation()}
      >
        {/* Carte avec hover effect */}
        <CardHover rarity={rarity} className="relative w-full rounded-3xl"
          style={{
            aspectRatio: '0.714',
            background: RARITY_BG[rarity] ?? RARITY_BG.common,
            boxShadow: `0 0 100px ${hexToRgba(color, .65)}, 0 0 200px ${hexToRgba(color, .25)}`,
            border: `1px solid ${hexToRgba(color, .5)}`,
            overflow: 'visible',
          }}
        >
          <div className="absolute inset-0 rounded-3xl overflow-hidden">
            {artUrl
              ? <Image src={artUrl} alt={name} fill className="object-contain" unoptimized />
              : <div className="w-full h-full flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full opacity-30"
                    style={{ background: `radial-gradient(circle, ${color}, transparent)` }} />
                </div>
            }
          </div>
        </CardHover>

        {/* Infos */}
        <div className="text-center w-full space-y-1.5">
          <p className="text-white font-black text-xl">{name}</p>
          <div className="flex items-center justify-center gap-3">
            <p className="text-sm font-bold uppercase tracking-widest" style={{ color }}>
              {rarity}
            </p>
            {family && <p className="text-white/30 text-xs capitalize">{family}</p>}
            {count && count > 1 && <p className="text-white/30 text-xs">×{count} copies</p>}
          </div>

          {/* Description */}
          {parsed?.text && (
            <p className="text-white/55 text-sm leading-relaxed mt-2 px-2">{parsed.text}</p>
          )}

          {/* Crédits artiste */}
          {parsed?.artistName && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-white/35 mt-1">
              <span>🎨</span>
              {parsed.artistUrl ? (
                <a href={parsed.artistUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[#a78bfa] hover:text-white underline underline-offset-2 transition-colors">
                  {parsed.artistName}
                </a>
              ) : (
                <span>{parsed.artistName}</span>
              )}
            </div>
          )}
        </div>

        <p className="text-white/20 text-xs">Clique en dehors pour fermer</p>
      </div>
    </div>
  )
}
