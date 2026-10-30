import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { customCards, families } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getHiddenCardIds } from '@/lib/cache/cards-cache'

const getPublicCards = unstable_cache(
  async () => {
    const activeFamilies = (await db.select({ key: families.key }).from(families).where(eq(families.active, true))).map(f => f.key)
    // Les cartes exclusives (promo de raid) restent visibles quelle que soit leur famille
    // (elles peuvent n'en avoir aucune) : elles ne sortent jamais des boosters de toute façon
    return (await db.select().from(customCards)).filter(c => c.exclusive || c.family === 'global' || activeFamilies.includes(c.family))
  },
  ['public-cards'],
  { revalidate: 300, tags: ['public-cards'] },
)

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin') === '1') {
    return NextResponse.json(await db.select().from(customCards))
  }

  // Cartes masquées exclues (liste lue en direct → effet immédiat) : toutes les pages
  // joueurs construisent leurs listes à partir d'ici
  const [cards, hidden] = await Promise.all([getPublicCards(), getHiddenCardIds()])
  const body = JSON.stringify(cards.filter(c => !hidden.has(c.id)))

  // Revalidation à chaque appel (no-cache) + ETag : toujours à jour, et si rien n'a changé
  // le navigateur reçoit un 304 vide au lieu de toute la liste
  const etag = `"${createHash('sha1').update(body).digest('base64url')}"`
  const headers = { ETag: etag, 'Cache-Control': 'public, no-cache' }
  if (req.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304, headers })
  return new NextResponse(body, { headers: { ...headers, 'Content-Type': 'application/json' } })
}
