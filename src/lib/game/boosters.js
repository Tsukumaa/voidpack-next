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

function normalizeApiError(data, fallback = 'Code booster invalide.') {
  const message = data?.error ?? fallback;

  if (/Connexion Discord/i.test(message)) return new BoosterCodeError(message, 'AUTH_REQUIRED');
  if (/manquant|format/i.test(message)) return new BoosterCodeError(message, 'INVALID_FORMAT');
  if (/introuvable|invalide/i.test(message)) return new BoosterCodeError(message, 'NOT_FOUND');
  if (/désactiv/i.test(message)) return new BoosterCodeError(message, 'DISABLED');
  if (/expir/i.test(message)) return new BoosterCodeError(message, 'EXPIRED');
  if (/déjà|utilisé/i.test(message)) return new BoosterCodeError(message, 'ALREADY_USED');

  return new BoosterCodeError(message, 'API_ERROR');
}

export async function redeemBoosterCode(rawCode) {
  const code = assertValidBoosterCode(rawCode);

  const res = await fetch('/api/booster/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw normalizeApiError(data);
  }

  if (!data?.redemptionId) {
    throw new BoosterCodeError('Réponse invalide pour ce code booster.', 'INVALID_RESPONSE');
  }

  return Object.freeze({
    redemptionId: data.redemptionId,
    codeId: data.codeId,
    boosterType: data.boosterType ?? BOOSTER_TYPES.VOID,
    code,
    normalizedCode: data.normalizedCode ?? code,
    userId: data.userId,
    redeemedAt: data.redeemedAt ?? new Date().toISOString(),
    remainingRedemptions: Number(data.remainingRedemptions ?? 0),
    metadata: data.metadata ?? {},
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

export async function completeBoosterRedemption(redemptionId, cards) {
  if (!redemptionId) {
    throw new BoosterCodeError('Redemption booster manquante.', 'MISSING_REDEMPTION');
  }

  const serializedCards = serializeCardsForCompletion(cards);

  const res = await fetch('/api/booster/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ redemptionId, cards: serializedCards }),
  });

  const data = await res.json();
  if (!res.ok) throw normalizeApiError(data);

  return data;
}

export async function getMyBoosterRedemptions({ limit = 20 } = {}) {
  const res = await fetch(`/api/booster/redemptions?limit=${limit}`);
  const data = await res.json();
  if (!res.ok) throw normalizeApiError(data);
  return Object.freeze(data ?? []);
}
