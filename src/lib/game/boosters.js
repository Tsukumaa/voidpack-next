import { getFam, getFamOrder, getFamRegistry } from '@/lib/game/families-registry';
import { getSupabaseClient, getUser } from '@/lib/supabase/client';

import {
  PACK_TYPES as BOOSTER_TYPES,
  PACK_TYPE_LABELS as BOOSTER_TYPE_LABELS,
  getPackPool,
  rollPackByType,
} from '@/lib/game/packs';

export { BOOSTER_TYPES, BOOSTER_TYPE_LABELS };

export const BOOSTER_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{5,63}$/;

export class BoosterCodeError extends Error {
  constructor(message, code = 'BOOSTER_CODE_ERROR') {
    super(message);
    this.name = 'BoosterCodeError';
    this.code = code;
  }
}

export function normalizeBoosterCode(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[–—]/g, '-');
}

export function assertValidBoosterCode(rawCode) {
  const code = normalizeBoosterCode(rawCode);

  if (!code) {
    throw new BoosterCodeError('Entre un code booster.', 'EMPTY_CODE');
  }

  if (!BOOSTER_CODE_PATTERN.test(code)) {
    throw new BoosterCodeError('Format de code invalide.', 'INVALID_FORMAT');
  }

  return code;
}

export function getBoosterLabel(type) {
  return BOOSTER_TYPE_LABELS[type] ?? BOOSTER_TYPE_LABELS[BOOSTER_TYPES.VOID];
}

function getPoolForBoosterType(type) {
  return getPackPool(type);
}


async function getAuthenticatedUser() {
  const user = await getUser();

  if (!user) {
    throw new BoosterCodeError('Connecte-toi avec Discord pour utiliser un code booster.', 'AUTH_REQUIRED');
  }

  return user;
}

function normalizeSupabaseError(error) {
  const message = error?.message ?? 'Code booster invalide.';

  if (/Connexion Discord/i.test(message)) return new BoosterCodeError(message, 'AUTH_REQUIRED');
  if (/manquant|format/i.test(message)) return new BoosterCodeError(message, 'INVALID_FORMAT');
  if (/introuvable|invalide/i.test(message)) return new BoosterCodeError(message, 'NOT_FOUND');
  if (/désactiv/i.test(message)) return new BoosterCodeError(message, 'DISABLED');
  if (/expir/i.test(message)) return new BoosterCodeError(message, 'EXPIRED');
  if (/déjà|utilisé/i.test(message)) return new BoosterCodeError(message, 'ALREADY_USED');

  return new BoosterCodeError(message, 'SUPABASE_ERROR');
}

export async function redeemBoosterCode(rawCode, { supabase } = {}) {
  const user = await getAuthenticatedUser();
  const code = assertValidBoosterCode(rawCode);
  const resolvedClient = supabase ?? await getSupabaseClient();

  const { data, error } = await resolvedClient.rpc('redeem_booster_code', {
    input_code: code,
  });

  if (error) {
    throw normalizeSupabaseError(error);
  }

  const redemption = Array.isArray(data) ? data[0] : data;

  if (!redemption?.redemption_id) {
    throw new BoosterCodeError('Réponse Supabase invalide pour ce code booster.', 'INVALID_RESPONSE');
  }

  return Object.freeze({
    redemptionId: redemption.redemption_id,
    codeId: redemption.code_id,
    boosterType: redemption.booster_type ?? BOOSTER_TYPES.VOID,
    code,
    normalizedCode: redemption.code ?? code,
    userId: user.id,
    redeemedAt: redemption.redeemed_at ?? new Date().toISOString(),
    remainingRedemptions: Number(redemption.remaining_redemptions ?? 0),
    metadata: redemption.metadata ?? {},
  });
}

export function rollPackForRedemption(redemption, { pityState, random } = {}) {
  const boosterType = redemption?.boosterType ?? BOOSTER_TYPES.VOID;
  const pack = rollPackByType(boosterType, { pityState, random });

  return Object.freeze({
    ...pack,
    boosterType,
    redemptionId: redemption?.redemptionId ?? null,
  });
}

function serializeCardsForCompletion(cards) {
  return cards.map((card) => ({
    id: card.id,
    card_id: card.id,
    rarity: card.rarityKey ?? card.rarity?.key ?? card.rarity,
    family: card.familyKey ?? card.family?.key ?? card.family ?? 'global',
    name: card.name ?? null,
    character: card.character ?? null,
    image: card.image ?? null,
    source: card.source ?? 'pack',
  }));
}

export async function completeBoosterRedemption(redemptionId, cards, { supabase } = {}) {
  if (!redemptionId) {
    throw new BoosterCodeError('Redemption booster manquante.', 'MISSING_REDEMPTION');
  }

  const resolvedClient = supabase ?? await getSupabaseClient();
  const serializedCards = serializeCardsForCompletion(cards);

  const { data, error } = await resolvedClient.rpc('complete_booster_redemption', {
    input_redemption_id: redemptionId,
    input_cards: serializedCards,
  });

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return data;
}

export async function getMyBoosterRedemptions({ supabase, limit = 20 } = {}) {
  const user = await getAuthenticatedUser();
  const resolvedClient = supabase ?? await getSupabaseClient();

  const { data, error } = await resolvedClient
    .from('booster_code_redemptions')
    .select('id,code_id,user_id,status,redeemed_at,completed_at,cards,metadata')
    .eq('user_id', user.id)
    .order('redeemed_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return Object.freeze(data ?? []);
}
