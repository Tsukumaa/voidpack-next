import { normalizeCustomCard, setCustomCards } from './cards.js';

export async function fetchCustomCardsPublic() {
  const res = await fetch('/api/cards');
  if (!res.ok) throw new Error('Failed to fetch custom cards');
  const data = await res.json();
  const cards = (data ?? []).map(normalizeCustomCard);
  setCustomCards(cards);
  return cards;
}
