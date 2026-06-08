import { getFam, getFamOrder, getFamRegistry } from '@/lib/game/families-registry';
import { getSupabaseClient, getUser } from '@/lib/supabase/client';
import { hydrateCard, RARITIES } from '@/lib/game/cards';

export const PLAYER_CARDS_TABLE = 'player_cards';

function normalizeStoredCard(row) {
  // Remapper "uncommon" → "common" pour compatibilité avec les anciennes données en base
  const rarityKey = row.rarity === 'uncommon' ? 'common' : (row.rarity ?? 'common');
  const rarity = RARITIES[rarityKey] ?? RARITIES['common'];

  return Object.freeze({
    id: row.id,
    userId: row.user_id,
    cardId: row.card_id,
    rarityKey,
    rarity,
    familyKey: row.family ?? row.metadata?.family ?? 'global',
    family: getFam(row.family ?? row.metadata?.family),
    obtainedAt: row.obtained_at,
    metadata: row.metadata ?? {},
  });
}

function normalizeCardForInsert(card, userId) {
  const rarityKey = card.rarityKey ?? card.rarity?.key ?? card.rarity;

  if (!card.id) {
    throw new Error('Impossible d’ajouter une carte sans id.');
  }

  if (!RARITIES[rarityKey]) {
    throw new Error(`Rareté invalide pour la carte ${card.id}.`);
  }

  return {
    user_id: userId,
    card_id: card.id,
    rarity: rarityKey,
    family: card.familyKey ?? card.family?.key ?? card.family ?? 'global',
    metadata: {
      name: card.name ?? null,
      character: card.character ?? null,
      image: card.image ?? null,
      family: card.familyKey ?? card.family?.key ?? card.family ?? 'global',
      source: card.source ?? 'pack',
      rolled_at: new Date().toISOString(),
    },
  };
}

async function getAuthenticatedUser() {
  const user = await getUser();

  if (!user) {
    throw new Error('Utilisateur non connecté.');
  }

  return user;
}

export async function getCollection({ supabase } = {}) {
  const user = await getAuthenticatedUser();
  const resolvedClient = supabase ?? await getSupabaseClient();

  const { data, error } = await resolvedClient
    .from(PLAYER_CARDS_TABLE)
    .select('id,user_id,card_id,rarity,family,obtained_at,metadata')
    .eq('user_id', user.id)
    .order('obtained_at', { ascending: false });

  if (error) {
    throw error;
  }

  return Object.freeze((data ?? []).map(normalizeStoredCard));
}

export async function addCards(cards, { supabase } = {}) {
  const user = await getAuthenticatedUser();
  const resolvedClient = supabase ?? await getSupabaseClient();
  const cardsToInsert = Array.isArray(cards) ? cards : [cards];

  if (cardsToInsert.length === 0) {
    return Object.freeze([]);
  }

  const rows = cardsToInsert.map((card) => normalizeCardForInsert(card, user.id));

  const { data, error } = await resolvedClient
    .from(PLAYER_CARDS_TABLE)
    .insert(rows)
    .select('id,user_id,card_id,rarity,family,obtained_at,metadata');

  if (error) {
    throw error;
  }

  return Object.freeze((data ?? []).map(normalizeStoredCard));
}

export async function hasCard(cardId) {
  const collection = await getCollection();
  return collection.some((entry) => entry.cardId === cardId);
}

export async function getCardCount(cardId) {
  const collection = await getCollection();
  return collection.filter((entry) => entry.cardId === cardId).length;
}

export function groupCollectionByCard(collection) {
  const groups = new Map();

  for (const entry of collection) {
    const current = groups.get(entry.cardId) ?? {
      cardId: entry.cardId,
      rarityKey: entry.rarityKey,
      rarity: entry.rarity,
      familyKey: entry.familyKey,
      family: entry.family,
      count: 0,
      copies: [],
      latestObtainedAt: entry.obtainedAt,
      metadata: entry.metadata,
    };

    current.count += 1;
    current.copies.push(entry);

    if (new Date(entry.obtainedAt) > new Date(current.latestObtainedAt)) {
      current.latestObtainedAt = entry.obtainedAt;
      current.metadata = entry.metadata;
    }

    groups.set(entry.cardId, current);
  }

  return Object.freeze([...groups.values()].map((group) => Object.freeze({
    ...group,
    copies: Object.freeze(group.copies),
  })));
}

export function hydrateCollectionEntry(entry, pool = []) {
  const baseCard = pool.find((card) => card.id === entry.cardId);

  if (!baseCard) {
    return entry;
  }

  return Object.freeze({
    ...entry,
    card: hydrateCard(baseCard),
  });
}
