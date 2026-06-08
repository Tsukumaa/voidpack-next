/**
 * pity-service.js
 * Gestion du pity state entre le client et Supabase.
 *
 * Responsabilités :
 *  - Charger le pity state au démarrage de l'opening
 *  - Mettre à jour le pity après chaque pack ouvert
 *  - Fournir le pity state à rollPackByType()
 */

import { getSupabaseClient } from '@/lib/supabase/client';
import { createPityState } from '@/lib/game/cards';

// ─────────────────────────────────────────────
// CHARGEMENT
// ─────────────────────────────────────────────

/**
 * Charge (ou crée) le pity state du joueur connecté depuis Supabase.
 * Retourne un objet compatible avec createPityState() / rollPackByType().
 *
 * En cas d'erreur réseau ou d'utilisateur non connecté,
 * retourne un pity state vide plutôt que de bloquer l'ouverture.
 */
export async function loadPityState({ supabase } = {}) {
  try {
    const client = supabase ?? await getSupabaseClient();
    const { data, error } = await client.rpc('get_or_create_pity_state');

    if (error) {
      console.warn('[pity] Impossible de charger le pity state :', error.message);
      return createPityState();
    }

    return createPityState({
      packsSinceLegendary: data?.packsSinceLegendary ?? 0,
      packsSinceVoid:      data?.packsSinceVoid ?? 0,
    });
  } catch (err) {
    console.warn('[pity] Erreur inattendue lors du chargement :', err);
    return createPityState();
  }
}

// ─────────────────────────────────────────────
// MISE À JOUR APRÈS OUVERTURE
// ─────────────────────────────────────────────

/**
 * Envoie les cartes pullées à Supabase pour mettre à jour le pity.
 * Appelé après complete_booster_redemption.
 *
 * @param {Array} cards — tableau de cartes hydrées (avec .rarityKey)
 * @param {Object} options
 * @returns {Object} — nouveau pity state et flags de pull (pulledVoid, pulledLegendary)
 */
export async function syncPityAfterPack(cards = [], { supabase } = {}) {
  try {
    const client = supabase ?? await getSupabaseClient();

    // On envoie seulement les rarités nécessaires (pas les données visuelles)
    const inputCards = cards.map((card) => ({
      rarity: card.rarityKey ?? card.rarity?.key ?? card.rarity,
    }));

    const { data, error } = await client.rpc('update_pity_after_pack', {
      input_cards: inputCards,
    });

    if (error) {
      console.warn('[pity] Impossible de mettre à jour le pity state :', error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.warn('[pity] Erreur inattendue lors de la mise à jour :', err);
    return null;
  }
}

// ─────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────

/**
 * Vérifie si une pull Void doit déclencher une animation "moment sacré".
 * Utilisable par l'UI pour décider d'un traitement exceptionnel.
 */
export function isVoidPullMoment(cards = []) {
  return cards.some((card) => (card.rarityKey ?? card.rarity?.key ?? card.rarity) === 'void');
}

/**
 * Vérifie si une pull Legendary doit déclencher une animation cinématique.
 */
export function isLegendaryPullMoment(cards = []) {
  return cards.some((card) => {
    const rarity = card.rarityKey ?? card.rarity?.key ?? card.rarity;
    return rarity === 'legendary' || rarity === 'void';
  });
}
