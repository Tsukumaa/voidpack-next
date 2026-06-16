import { createPityState } from '@/lib/game/cards';

export async function loadPityState() {
  try {
    const res = await fetch('/api/pity');
    if (!res.ok) return createPityState();
    const data = await res.json();
    return createPityState({
      packsSinceLegendary: data?.packsSinceLegendary ?? 0,
      packsSinceVoid:      data?.packsSinceVoid ?? 0,
    });
  } catch (err) {
    console.warn('[pity] Erreur chargement :', err);
    return createPityState();
  }
}

export async function syncPityAfterPack(cards = []) {
  try {
    const inputCards = cards.map(card => ({
      rarity: card.rarityKey ?? card.rarity?.key ?? card.rarity,
    }));
    const res = await fetch('/api/pity', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(inputCards),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[pity] Erreur sync :', err);
    return null;
  }
}

export function isVoidPullMoment(cards = []) {
  return cards.some(card => (card.rarityKey ?? card.rarity?.key ?? card.rarity) === 'void');
}

export function isLegendaryPullMoment(cards = []) {
  return cards.some(card => {
    const rarity = card.rarityKey ?? card.rarity?.key ?? card.rarity;
    return rarity === 'legendary' || rarity === 'void';
  });
}
