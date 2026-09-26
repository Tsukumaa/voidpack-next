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
