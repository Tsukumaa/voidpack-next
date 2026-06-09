/**
 * cards-public.js
 * Fonctions publiques liées aux cartes — utilisables sans droits admin.
 * Séparé de admin.js pour éviter de charger le bundle admin pour tous les joueurs.
 */

import { getSupabaseClient } from '../core/supabase.js';
import { normalizeCustomCard, setCustomCards } from './cards.js';

/**
 * Charge les cartes custom depuis Supabase (lecture publique).
 * Appelé au boot pour alimenter le pool de cartes de tous les joueurs.
 */
export async function fetchCustomCardsPublic() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('list_custom_cards');
  if (error) throw error;
  const cards = (data ?? []).map(normalizeCustomCard);
  setCustomCards(cards);
  return cards;
}
