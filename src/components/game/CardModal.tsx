'use client'
import Image from 'next/image'
import { CardHover } from '@/components/game/CardHover'
import { CardFrame } from '@/components/game/CardFrame'

const RARITY_COLOR: Record<string, string> = {
  void: '#7b2bff', legendary: '#f59e0b', epic: '#ec4899',
  rare: '#3b82f6', common: '#9ca3af',
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
  artist?: string | null
  artistUrl?: string | null
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

export function CardModal({ name, rarity, family, artUrl, description, artist, artistUrl, count, onClose }: CardModalProps) {
  const color = RARITY_COLOR[rarity] ?? '#9ca3af'
  const parsed = description ? parseDescription(description) : null
  // Priorité aux colonnes dédiées ; fallback sur le tag dans la description (anciennes cartes)
  const artistName = artist || parsed?.artistName || null
  const artistLink = artistUrl || parsed?.artistUrl || null
  const descText   = artist ? (description?.trim() || null) : (parsed?.text || null)

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
        <CardHover rarity={rarity} className="relative w-full"
          style={{
            aspectRatio: '0.714',
            boxShadow: `0 0 80px ${hexToRgba(color, .5)}, 0 0 160px ${hexToRgba(color, .2)}`,
          }}
        >
          <CardFrame rarity={rarity} name={name} style={{ position: 'absolute', inset: 0 }}>
            {artUrl
              ? <Image src={artUrl} alt={name} fill className="object-cover" unoptimized />
              : <div className="w-full h-full flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full opacity-30"
                    style={{ background: `radial-gradient(circle, ${color}, transparent)` }} />
                </div>
            }
          </CardFrame>
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
          {descText && (
            <p className="text-white/55 text-sm leading-relaxed mt-2 px-2">{descText}</p>
          )}

          {/* Crédits artiste */}
          {artistName && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-white/35 mt-1">
              <span>🎨 Artiste:</span>
              {artistLink ? (
                <a href={artistLink} target="_blank" rel="noopener noreferrer"
                  className="text-[#a78bfa] hover:text-white underline underline-offset-2 transition-colors">
                  {artistName}
                </a>
              ) : (
                <span>{artistName}</span>
              )}
            </div>
          )}
        </div>

        <p className="text-white/20 text-xs">Clique en dehors pour fermer</p>
      </div>
    </div>
  )
}
