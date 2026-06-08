import { getFam, getFamOrder, getFamRegistry } from '@/lib/game/families-registry';
import {
  CARD_POOL,
  RARITIES,
  RARITY_KEYS,
  RARITY_ORDER,
  rollPack,
  getActiveCardPool,
} from '@/lib/game/cards';

export const PACK_TYPES = Object.freeze({
  VOID: 'void',
  HARMONY: 'harmony',
  PACIFIC_BLUFFS: 'pacific-bluffs',
  NEON_DIVIDE: 'neon-divide',
  ASH_DISTRICT: 'ash-district',
});

export const PACK_TYPE_LABELS = Object.freeze({
  [PACK_TYPES.VOID]:          'VOID Pack',
  [PACK_TYPES.HARMONY]:       'Harmony Pack',
  [PACK_TYPES.PACIFIC_BLUFFS]: 'Pacific Bluffs Pack',
  [PACK_TYPES.NEON_DIVIDE]:   'Neon Divide Pack',
  [PACK_TYPES.ASH_DISTRICT]:  'Ash District Pack',
});

// ─────────────────────────────────────────────
// POIDS DE RARETÉ
//
// Base 10 000 pour correspondre exactement aux % définis :
//   Common    64.8% → 6480
//   Rare      25.0% → 2500
//   Epic       8.0% →  800
//   Legendary  2.0% →  200
//   Void       0.2% →   20
//
// Pack famille : légèrement moins de Void (plus ciblé famille),
// et légèrement moins de Legendary pour compenser le pool réduit.
// ─────────────────────────────────────────────

const GLOBAL_PACK_WEIGHTS = Object.freeze({
  [RARITY_KEYS.COMMON]:    6480,   // 64.8%
  [RARITY_KEYS.RARE]:      2500,   // 25.0%
  [RARITY_KEYS.EPIC]:       800,   //  8.0%
  [RARITY_KEYS.LEGENDARY]:  200,   //  2.0%
  [RARITY_KEYS.VOID]:        20,   //  0.2%
});

const FAMILY_PACK_WEIGHTS = Object.freeze({
  [RARITY_KEYS.COMMON]:    6530,   // 65.3% — légèrement plus de Common sur pack famille
  [RARITY_KEYS.RARE]:      2500,   // 25.0%
  [RARITY_KEYS.EPIC]:       790,   //  7.9%
  [RARITY_KEYS.LEGENDARY]:  170,   //  1.7% — légèrement réduit (pool famille plus petit)
  [RARITY_KEYS.VOID]:        10,   //  0.1% — Void plus rare sur pack famille
});

// ─────────────────────────────────────────────
// DÉFINITIONS DES PACKS
// ─────────────────────────────────────────────

export const PACK_DEFINITIONS = Object.freeze({
  [PACK_TYPES.VOID]: Object.freeze({
    key: PACK_TYPES.VOID,
    label: PACK_TYPE_LABELS[PACK_TYPES.VOID],
    description: 'Pool global : toutes les familles + cartes VOID globales.',
    family: 'global',
    poolMode: 'global',
    size: 5,
    rarityWeights: GLOBAL_PACK_WEIGHTS,
    includesGlobalVoid: true,
  }),
  [PACK_TYPES.HARMONY]: Object.freeze({
    key: PACK_TYPES.HARMONY,
    label: PACK_TYPE_LABELS[PACK_TYPES.HARMONY],
    description: 'Pack famille Harmony, avec accès très rare aux anomalies VOID globales.',
    family: 'harmony',
    poolMode: 'family',
    size: 5,
    rarityWeights: FAMILY_PACK_WEIGHTS,
    includesGlobalVoid: true,
  }),
  [PACK_TYPES.PACIFIC_BLUFFS]: Object.freeze({
    key: PACK_TYPES.PACIFIC_BLUFFS,
    label: PACK_TYPE_LABELS[PACK_TYPES.PACIFIC_BLUFFS],
    description: 'Pack famille Pacific Bluffs, avec accès très rare aux anomalies VOID globales.',
    family: 'pacific-bluffs',
    poolMode: 'family',
    size: 5,
    rarityWeights: FAMILY_PACK_WEIGHTS,
    includesGlobalVoid: true,
  }),
  [PACK_TYPES.NEON_DIVIDE]: Object.freeze({
    key: PACK_TYPES.NEON_DIVIDE,
    label: PACK_TYPE_LABELS[PACK_TYPES.NEON_DIVIDE],
    description: 'Pack famille Neon Divide, avec accès très rare aux anomalies VOID globales.',
    family: 'neon-divide',
    poolMode: 'family',
    size: 5,
    rarityWeights: FAMILY_PACK_WEIGHTS,
    includesGlobalVoid: true,
  }),
  [PACK_TYPES.ASH_DISTRICT]: Object.freeze({
    key: PACK_TYPES.ASH_DISTRICT,
    label: PACK_TYPE_LABELS[PACK_TYPES.ASH_DISTRICT],
    description: 'Pack famille Ash District, avec accès très rare aux anomalies VOID globales.',
    family: 'ash-district',
    poolMode: 'family',
    size: 5,
    rarityWeights: FAMILY_PACK_WEIGHTS,
    includesGlobalVoid: true,
  }),
});

// ─────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────

// ── Packs dynamiques (familles Supabase) ─────────────────────────────────────
function buildDynamicPackDefinitions() {
  const defs = { ...PACK_DEFINITIONS };
  const families = getFamRegistry();
  const order = getFamOrder();
  order.forEach(key => {
    if (key === 'global' || defs[key]) return; // déjà défini
    const fam = families[key];
    if (!fam) return;
    defs[key] = Object.freeze({
      key,
      label: fam.label + ' Pack',
      description: `Pack famille ${fam.label}.`,
      family: key,
      poolMode: 'family',
      size: 5,
      rarityWeights: FAMILY_PACK_WEIGHTS,
      includesGlobalVoid: false, // pool pur famille — pas de dilution par les cartes global
    });
  });
  return defs;
}

export function normalizePackType(type) {
  const value = String(type ?? PACK_TYPES.VOID).trim().toLowerCase();
  const defs = buildDynamicPackDefinitions();
  return defs[value] ? value : PACK_TYPES.VOID;
}

export function getPackDefinition(type) {
  const defs = buildDynamicPackDefinitions();
  const key = normalizePackType(type);
  return defs[key];
}

export function getPackOptions() {
  return Object.values(buildDynamicPackDefinitions()).map((pack) => ({
    key: pack.key,
    label: pack.label,
    description: pack.description,
    family: pack.family,
    familyLabel: getFam(pack.family)?.label ?? 'Global',
  }));
}

export function getPackPool(type, pool = getActiveCardPool()) {
  const pack = getPackDefinition(type);

  if (pack.poolMode === 'global') return pool;

  const familyCards = pool.filter((card) => card.family === pack.family);
  const globalVoidCards = pack.includesGlobalVoid
    ? pool.filter((card) => card.rarity === RARITY_KEYS.VOID || card.family === 'global')
    : [];

  const merged = new Map();
  [...familyCards, ...globalVoidCards].forEach((card) => merged.set(card.id, card));
  return [...merged.values()];
}

export function getPackDropRates(type) {
  const pack = getPackDefinition(type);
  const total = RARITY_ORDER.reduce((sum, rarityKey) => {
    return sum + Number(pack.rarityWeights[rarityKey] ?? RARITIES[rarityKey]?.weight ?? 0);
  }, 0);

  return RARITY_ORDER.map((rarityKey) => {
    const weight = Number(pack.rarityWeights[rarityKey] ?? RARITIES[rarityKey]?.weight ?? 0);
    return Object.freeze({
      rarity: rarityKey,
      label: RARITIES[rarityKey].label,
      weight,
      percentage: total > 0 ? (weight / total) * 100 : 0,
    });
  });
}

export function rollPackByType(type, { pityState, random, pool = getActiveCardPool() } = {}) {
  const pack = getPackDefinition(type);
  const packPool = getPackPool(pack.key, pool);

  if (!packPool.length) {
    throw new Error(`Aucune carte disponible pour ${pack.label}. Ajoute des cartes dans l'admin avant d'ouvrir un pack.`);
  }

  const result = rollPack({
    size: pack.size,
    pityState,
    pool: packPool,
    random,
    rarityWeights: pack.rarityWeights,
  });

  return Object.freeze({
    ...result,
    packType: pack.key,
    packDefinition: pack,
    poolSize: packPool.length,
  });
}
