import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const RARITY_WEIGHTS: Record<string, number> = {
  common:    60,
  uncommon:  25,
  rare:      10,
  epic:       4,
  legendary:  0.8,
  void:       0.2,
}

function weightedRoll(pool: { rarity: string }[]): number {
  const weights = pool.map(c => RARITY_WEIGHTS[c.rarity] ?? 10)
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r <= 0) return i
  }
  return pool.length - 1
}

export async function POST(req: NextRequest) {
  const { booster_type = 'void', count = 5 } = await req.json()

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Pool de cartes (filtré par famille si pas void)
  let query = sb.from('custom_cards').select('id, name, rarity, family, image_url, description')
  if (booster_type !== 'void') query = query.eq('family', booster_type)
  const { data: pool, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Cartes placeholder si aucune carte dans cette famille
  if (!pool || !pool.length) {
    const rarities = ['common','uncommon','rare','epic','legendary']
    return NextResponse.json({
      cards: Array.from({ length: count }, (_, i) => ({
        id: `placeholder-${i}`,
        name: `Carte mystère ${i + 1}`,
        rarity: rarities[Math.floor(Math.random() * rarities.length)],
        family: booster_type,
        artUrl: null,
      }))
    })
  }

  // Tirage pondéré AVEC remise si pool < count (pour toujours avoir `count` cartes)
  const picked: typeof pool = []
  for (let i = 0; i < count; i++) {
    const idx = weightedRoll(pool)
    picked.push(pool[idx])
  }

  // Garantir au moins une carte uncommon+
  const hasGood = picked.some(c => c.rarity !== 'common')
  if (!hasGood && picked.length > 0) {
    const goodPool = pool.filter(c => c.rarity !== 'common')
    if (goodPool.length) picked[picked.length - 1] = goodPool[Math.floor(Math.random() * goodPool.length)]
  }

  return NextResponse.json({
    cards: picked.map(c => ({
      id: c.id, name: c.name, rarity: c.rarity, family: c.family, artUrl: c.image_url ?? null, description: (c as any).description ?? null,
    }))
  })
}
