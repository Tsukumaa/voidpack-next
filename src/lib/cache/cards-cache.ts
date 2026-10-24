import { db } from '@/lib/db'
import { customCards, families } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const TTL = 5 * 60 * 1000 // 5 min

type CardRow = typeof customCards.$inferSelect
let cachedCards: { data: CardRow[]; ts: number } | null = null
let cachedFamilies: { data: string[]; ts: number } | null = null

export function invalidateCardsCache() {
  cachedCards = null
  cachedFamilies = null
}

export async function getCachedActiveFamilies(): Promise<string[]> {
  if (cachedFamilies && Date.now() - cachedFamilies.ts < TTL) return cachedFamilies.data
  const rows = await db.select({ key: families.key }).from(families).where(eq(families.active, true))
  cachedFamilies = { data: rows.map(f => f.key), ts: Date.now() }
  return cachedFamilies.data
}

export async function getCachedAllCards(): Promise<CardRow[]> {
  if (cachedCards && Date.now() - cachedCards.ts < TTL) return cachedCards.data
  const rows = await db.select().from(customCards)
  cachedCards = { data: rows, ts: Date.now() }
  return cachedCards.data
}

// Identifiants des cartes masquées par l'admin (indisponibles côté joueurs).
// Lecture directe, sans cache : le masquage doit s'appliquer immédiatement sur tous les
// serveurs (le cache ci-dessus n'est invalidé que sur l'instance qui a traité l'admin).
// Requête minuscule : quelques dizaines de cartes, seulement l'id des masquées.
export async function getHiddenCardIds(): Promise<Set<string>> {
  const rows = await db.select({ id: customCards.id }).from(customCards).where(eq(customCards.hidden, true))
  return new Set(rows.map(r => r.id))
}

// Vrai si au moins une des cartes est masquée (échanges, marché…)
export async function hasHiddenCard(...ids: (string | null | undefined)[]): Promise<boolean> {
  const hidden = await getHiddenCardIds()
  return ids.some(id => !!id && hidden.has(id))
}
