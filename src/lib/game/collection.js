import { getFam } from '@/lib/game/families-registry';
import { hydrateCard, RARITIES } from '@/lib/game/cards';

export const PLAYER_CARDS_TABLE = 'player_cards';

function normalizeStoredCard(row) {
  const rarityKey = row.rarity === 'uncommon' ? 'common' : (row.rarity ?? 'common');
  const rarity = RARITIES[rarityKey] ?? RARITIES['common'];
  const meta = typeof row.metadata === 'string' ? (() => { try { return JSON.parse(row.metadata || '{}') } catch { return {} } })() : (row.metadata ?? {});

  return Object.freeze({
    id:          row.id,
    userId:      row.user_id ?? row.userId,
    cardId:      row.card_id ?? row.cardId,
    rarityKey,
    rarity,
    familyKey:   row.family ?? meta?.family ?? 'global',
    family:      getFam(row.family ?? meta?.family),
    obtainedAt:  row.obtained_at ?? row.obtainedAt,
    metadata:    meta,
  });
}

export async function getCollection() {
  const res = await fetch('/api/collection');
  if (!res.ok) throw new Error('Failed to fetch collection');
  const data = await res.json();
  return Object.freeze((data ?? []).map(normalizeStoredCard));
}

export async function addCards(cards) {
  const cardsToInsert = Array.isArray(cards) ? cards : [cards];
  if (!cardsToInsert.length) return Object.freeze([]);

  const payload = cardsToInsert.map(card => {
    const rarityKey = card.rarityKey ?? card.rarity?.key ?? card.rarity;
    if (!card.id) throw new Error('Impossible d\'ajouter une carte sans id.');
    if (!RARITIES[rarityKey]) throw new Error(`Rareté invalide pour la carte ${card.id}.`);
    return {
      cardId:   card.id,
      rarity:   rarityKey,
      family:   card.familyKey ?? card.family?.key ?? card.family ?? 'global',
      metadata: JSON.stringify({
        name:      card.name ?? null,
        character: card.character ?? null,
        image:     card.image ?? null,
        family:    card.familyKey ?? card.family?.key ?? card.family ?? 'global',
        source:    card.source ?? 'pack',
        rolled_at: new Date().toISOString(),
      }),
    };
  });

  const res = await fetch('/api/collection', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to add cards');
  const data = await res.json();
  return Object.freeze((data ?? []).map(normalizeStoredCard));
}

export async function hasCard(cardId) {
  const collection = await getCollection();
  return collection.some(e => e.cardId === cardId);
}

export async function getCardCount(cardId) {
  const collection = await getCollection();
  return collection.filter(e => e.cardId === cardId).length;
}

export function groupCollectionByCard(collection) {
  const groups = new Map();

  for (const entry of collection) {
    const current = groups.get(entry.cardId) ?? {
      cardId:          entry.cardId,
      rarityKey:       entry.rarityKey,
      rarity:          entry.rarity,
      familyKey:       entry.familyKey,
      family:          entry.family,
      count:           0,
      copies:          [],
      latestObtainedAt: entry.obtainedAt,
      metadata:        entry.metadata,
    };
    current.count += 1;
    current.copies.push(entry);
    if (new Date(entry.obtainedAt) > new Date(current.latestObtainedAt)) {
      current.latestObtainedAt = entry.obtainedAt;
      current.metadata = entry.metadata;
    }
    groups.set(entry.cardId, current);
  }

  return Object.freeze([...groups.values()].map(group => Object.freeze({
    ...group,
    copies: Object.freeze(group.copies),
  })));
}

export function hydrateCollectionEntry(entry, pool = []) {
  const baseCard = pool.find(card => card.id === entry.cardId);
  if (!baseCard) return entry;
  return Object.freeze({ ...entry, card: hydrateCard(baseCard) });
}
