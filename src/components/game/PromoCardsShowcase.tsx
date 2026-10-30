'use client'
import { Sparkles } from 'lucide-react'
import { useFeatures } from '@/hooks/useFeatures'
import { CardHover } from '@/components/game/CardHover'
import { CardFrame } from '@/components/game/CardFrame'
import { CardMedia } from '@/components/game/CardMedia'

export interface PromoCardItem {
  id: string
  name: string
  rarity: string
  image_url: string | null
}

// Vrai pour les cartes promo : exclusives (récompenses de raid…) ou de rareté "promo".
// Elles ne vont pas dans la collection mais dans cet encart du profil.
export function isPromoCard(def: { exclusive?: boolean | number | null; rarity?: string | null } | null | undefined): boolean {
  return !!def && (!!def.exclusive || def.rarity === 'promo')
}

// Encart "Cartes promo" du profil : les cartes promo gagnées (raids…)
export function PromoCardsShowcase({ cards, isSelf = true, onCardClick }: {
  cards: PromoCardItem[]
  isSelf?: boolean
  onCardClick?: (card: PromoCardItem) => void
}) {
  // Masquable dans l'admin (Paramètres → Encart cartes promo). Caché tant que le réglage n'est pas chargé.
  const { features } = useFeatures()
  if (features.feature_promo_showcase !== true) return null
  return (
    // Fond flouté (comme la vitrine) avec un léger voile irisé
    <div className="rounded-2xl border border-yellow-400/20 p-4 backdrop-blur-md"
      style={{ background: 'linear-gradient(135deg, rgba(250,204,21,0.07), rgba(255,110,199,0.05), rgba(74,216,255,0.05)), rgba(8,6,16,0.55)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={15} className="text-yellow-300" />
        <h3 className="text-white font-bold text-sm">Cartes promotionnelles</h3>
        {cards.length > 0 && <span className="text-white/30 text-xs">{cards.length}</span>}
      </div>

      {cards.length === 0 ? (
        <p className="text-white/35 text-xs text-center py-4">
          {isSelf
            ? 'Aucune carte promo pour l’instant. Participe aux raids et fais tes missions chaque jour pour en gagner !'
            : 'Aucune carte promo pour l’instant.'}
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {cards.map(c => (
            <div key={c.id} onClick={() => onCardClick?.(c)}
              className={onCardClick ? 'cursor-pointer active:scale-95 transition-transform' : ''}>
              <CardHover rarity={c.rarity} className="relative" style={{ aspectRatio: '0.714' }}>
                <CardFrame rarity={c.rarity} name={c.name} glow={false} hideStats style={{ position: 'absolute', inset: 0 }}>
                  {c.image_url
                    ? <CardMedia src={c.image_url} alt={c.name} />
                    : <div className="w-full h-full bg-black" />}
                </CardFrame>
              </CardHover>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
