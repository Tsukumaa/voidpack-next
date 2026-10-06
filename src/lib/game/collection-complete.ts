import { db } from '@/lib/db'
import { playerCards } from '@/lib/db/schema'
import { and, inArray, sql } from 'drizzle-orm'
import { getCachedActiveFamilies, getCachedAllCards } from '@/lib/cache/cards-cache'

// Cartes à posséder pour le badge "collection complète" : mêmes règles que /api/cards
// (famille 'global' + familles actives). Les cartes des familles désactivées sont exclues,
// sinon personne ne peut jamais compléter la collection.
export async function getCompletableCardIds(): Promise<string[]> {
  const [cards, activeFamilies] = await Promise.all([getCachedAllCards(), getCachedActiveFamilies()])
  return cards.filter(c => c.family === 'global' || activeFamilies.includes(c.family)).map(c => c.id)
}

// Retourne l'ensemble des joueurs (parmi userIds) qui possèdent toutes les cartes obtenables.
export async function getCompleteCollectionUsers(userIds: string[]): Promise<Set<string>> {
  if (!userIds.length) return new Set()
  const cardIds = await getCompletableCardIds()
  if (!cardIds.length) return new Set()

  const rows = await db
    .select({ userId: playerCards.userId, owned: sql<number>`COUNT(DISTINCT ${playerCards.cardId})` })
    .from(playerCards)
    .where(and(inArray(playerCards.userId, userIds), inArray(playerCards.cardId, cardIds)))
    .groupBy(playerCards.userId)

  return new Set(rows.filter(r => Number(r.owned) >= cardIds.length).map(r => r.userId))
}
