import { getFam, getFamOrder, getFamRegistry } from '@/lib/game/families-registry';
const randomFloat = () => Math.random();

// ─────────────────────────────────────────────
// FAMILLES
// ─────────────────────────────────────────────

export const FAMILY_KEYS = Object.freeze({
  HARMONY: 'harmony',
  PACIFIC_BLUFFS: 'pacific-bluffs',
  NEON_DIVIDE: 'neon-divide',
  ASH_DISTRICT: 'ash-district',
  GLOBAL: 'global',
});

export const FAMILY_ORDER = Object.freeze([
  'harmony',
  'pacific-bluffs',
  'neon-divide',
  'ash-district',
  'global',
]);

export const FAMILIES = Object.freeze({
  ['harmony']: Object.freeze({
    key: 'harmony',
    label: 'Harmony',
    color: '#8b5cf6',
    description: 'Signaux synchrones, élégance violette et tension intérieure.',
  }),
  ['pacific-bluffs']: Object.freeze({
    key: 'pacific-bluffs',
    label: 'Pacific Bluffs',
    color: '#38bdf8',
    description: 'Lignes côtières, luxe froid et néons bleutés.',
  }),
  ['neon-divide']: Object.freeze({
    key: 'neon-divide',
    label: 'Neon Divide',
    color: '#2dd4bf',
    description: 'Technologie de rue, relais pirates et reflets teal.',
  }),
  ['ash-district']: Object.freeze({
    key: 'ash-district',
    label: 'Ash District',
    color: '#f97316',
    description: 'Braises urbaines, ruines chaudes et silhouettes instables.',
  }),
  ['global']: Object.freeze({
    key: 'global',
    label: 'Global',
    color: '#a78bfa',
    description: 'Pool global, anomalies et cartes VOID hors famille locale.',
  }),
});

// ─────────────────────────────────────────────
// RARITÉS
// Hiérarchie : Common → Rare → Epic → Legendary → Void
// Uncommon supprimé.
//
// Poids sur base 10 000 pour correspondre exactement aux % :
//   Common    64.8% → 6480
//   Rare      25.0% → 2500
//   Epic       8.0% →  800
//   Legendary  2.0% →  200
//   Void       0.2% →   20
//   Total            10000
// ─────────────────────────────────────────────

export const RARITY_KEYS = Object.freeze({
  COMMON: 'common',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary',
  VOID: 'void',
});

export const RARITY_ORDER = Object.freeze([
  RARITY_KEYS.COMMON,
  RARITY_KEYS.RARE,
  RARITY_KEYS.EPIC,
  RARITY_KEYS.LEGENDARY,
  RARITY_KEYS.VOID,
]);

export const RARITIES = Object.freeze({
  [RARITY_KEYS.COMMON]: Object.freeze({
    key: RARITY_KEYS.COMMON,
    label: 'Commun',
    weight: 6480,           // 64.8%
    color: '#6b7280',
    accent: 'anthracite',
    flashIntensity: 0.12,
    holoLevel: 0,
    hasCinematicReveal: false,
    hasPermanentAnimation: false,
  }),
  [RARITY_KEYS.RARE]: Object.freeze({
    key: RARITY_KEYS.RARE,
    label: 'Rare',
    weight: 2500,           // 25.0%
    color: '#38bdf8',
    accent: 'electric-blue',
    flashIntensity: 0.36,
    holoLevel: 2,
    hasCinematicReveal: false,
    hasPermanentAnimation: false,
  }),
  [RARITY_KEYS.EPIC]: Object.freeze({
    key: RARITY_KEYS.EPIC,
    label: 'Épique',
    weight: 800,            // 8.0%
    color: '#a855f7',
    accent: 'violet',
    flashIntensity: 0.55,
    holoLevel: 3,
    hasCinematicReveal: false,
    hasPermanentAnimation: false,
  }),
  [RARITY_KEYS.LEGENDARY]: Object.freeze({
    key: RARITY_KEYS.LEGENDARY,
    label: 'Légendaire',
    weight: 200,            // 2.0%
    color: '#facc15',
    accent: 'gold',
    flashIntensity: 0.78,
    holoLevel: 4,
    hasCinematicReveal: true,
    hasPermanentAnimation: false,
  }),
  [RARITY_KEYS.VOID]: Object.freeze({
    key: RARITY_KEYS.VOID,
    label: 'VOID',
    weight: 20,             // 0.2%
    color: '#050505',
    accent: 'void-portal',
    flashIntensity: 1,
    holoLevel: 5,
    hasCinematicReveal: true,
    hasPermanentAnimation: true,
  }),
});

// ─────────────────────────────────────────────
// PITY SYSTEM
//
// Legendary : garanti après 50 packs sans Legendary+
//   → reset quand on pull Legendary ou Void
//
// Void : garanti après 500 packs sans Void
//   → NE reset PAS sur pull Legendary
//   → reset uniquement sur pull Void
//
// Le pity state est indépendant par rareté.
// ─────────────────────────────────────────────

export const PITY_RULES = Object.freeze({
  legendaryAfterPacks: 50,
  voidAfterPacks: 500,
});

export const DEFAULT_PACK_SIZE = 5;

// ─────────────────────────────────────────────
// CARD POOL (placeholder — remplacé en runtime par les cartes custom admin)
// ─────────────────────────────────────────────

export const CARD_POOL = Object.freeze([
  { id: 'c-001', name: 'Signal Parasite',     rarity: RARITY_KEYS.COMMON,    family: 'neon-divide',    character: 'Archive',   image: null },
  { id: 'c-002', name: 'Neon Static',         rarity: RARITY_KEYS.COMMON,    family: 'harmony',        character: 'Archive',   image: null },
  { id: 'c-003', name: 'Back Alley Runner',   rarity: RARITY_KEYS.COMMON,    family: 'ash-district',   character: 'Crew',      image: null },
  { id: 'c-004', name: 'Bluffs Lookout',      rarity: RARITY_KEYS.COMMON,    family: 'pacific-bluffs', character: 'Scout',     image: null },
  { id: 'r-001', name: 'Electric Witness',    rarity: RARITY_KEYS.RARE,      family: 'harmony',        character: 'Oracle',    image: null },
  { id: 'r-002', name: 'Blue Shift Duelist',  rarity: RARITY_KEYS.RARE,      family: 'pacific-bluffs', character: 'Duelist',   image: null },
  { id: 'r-003', name: 'Midnight Protocol',   rarity: RARITY_KEYS.RARE,      family: 'neon-divide',    character: 'System',    image: null },
  { id: 'r-004', name: 'Ashline Pursuit',     rarity: RARITY_KEYS.RARE,      family: 'ash-district',   character: 'Hunter',    image: null },
  { id: 'e-001', name: 'Violet Fracture',     rarity: RARITY_KEYS.EPIC,      family: 'harmony',        character: 'Anomaly',   image: null },
  { id: 'e-002', name: 'Psyblade Bloom',      rarity: RARITY_KEYS.EPIC,      family: 'pacific-bluffs', character: 'Blade',     image: null },
  { id: 'e-003', name: 'Dreamcore Hacker',    rarity: RARITY_KEYS.EPIC,      family: 'neon-divide',    character: 'Hacker',    image: null },
  { id: 'e-004', name: 'Cinder Mirage',       rarity: RARITY_KEYS.EPIC,      family: 'ash-district',   character: 'Mirage',    image: null },
  { id: 'l-001', name: 'Golden Singularity',  rarity: RARITY_KEYS.LEGENDARY, family: 'harmony',        character: 'Legend',    image: null },
  { id: 'l-002', name: 'Solar Crown',         rarity: RARITY_KEYS.LEGENDARY, family: 'pacific-bluffs', character: 'Monarch',   image: null },
  { id: 'l-003', name: 'Ember Sovereign',     rarity: RARITY_KEYS.LEGENDARY, family: 'ash-district',   character: 'Sovereign', image: null },
  { id: 'v-001', name: 'VOID Origin',         rarity: RARITY_KEYS.VOID,      family: 'global',         character: 'VOID',      image: null },
  { id: 'v-002', name: 'Event Horizon Bloom', rarity: RARITY_KEYS.VOID,      family: 'global',         character: 'VOID',      image: null },
]);

// ─────────────────────────────────────────────
// PITY STATE
// ─────────────────────────────────────────────

/**
 * Crée un état de pity initial (ou depuis un override, ex: valeurs Supabase).
 *
 * packsSinceLegendary : nombre de packs depuis la dernière pull Legendary+
 *   → reset sur Legendary ou Void
 * packsSinceVoid : nombre de packs depuis la dernière pull Void
 *   → NE reset PAS sur Legendary, uniquement sur Void
 */
export function createPityState(overrides = {}) {
  return {
    packsSinceLegendary: 0,
    packsSinceVoid: 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// UTILITAIRES RARITÉ
// ─────────────────────────────────────────────

export function getRarityRank(rarityKey) {
  return RARITY_ORDER.indexOf(rarityKey);
}

export function isRarityAtLeast(rarityKey, minimumRarityKey) {
  return getRarityRank(rarityKey) >= getRarityRank(minimumRarityKey);
}

export function getCardsByRarity(rarityKey, pool = CARD_POOL) {
  return pool.filter((card) => card.rarity === rarityKey);
}

export function getCardsByFamily(familyKey, pool = CARD_POOL) {
  return pool.filter((card) => card.family === familyKey);
}

export function getFamilyDefinition(familyKey) {
  // Chercher dans les familles statiques d'abord, sinon construire un objet minimal
  return getFam(familyKey);
}

export function getCollectionFamilies(pool = CARD_POOL) {
  // Import dynamique pour éviter circular — on utilise un lazy require pattern
  let dynamicFamilies = getFamRegistry();
  let dynamicOrder = getFamOrder();
  try {
    // families.js est chargé au boot — ses exports sont disponibles via window si besoin
    // On passe par getFamiliesSync si disponible, sinon fallback statique
    if (typeof window !== 'undefined' && window.__VOID_FAMILIES__) {
      dynamicFamilies = window.__VOID_FAMILIES__;
      dynamicOrder = window.__VOID_FAMILY_ORDER__ ?? getFamOrder();
    }
  } catch(e) { /* fallback */ }

  const present = new Set(pool.map((card) => card.family ?? 'global'));
  // Inclure toutes les familles présentes dans le pool, même les dynamiques
  const allKeys = new Set([...dynamicOrder, ...present]);
  return [...allKeys]
    .filter(key => present.has(key))
    .map(key => dynamicFamilies[key] ?? { key, label: key, color: '#a78bfa', description: '' });
}

// ─────────────────────────────────────────────
// ROLL RARETÉ
// ─────────────────────────────────────────────

/**
 * Détermine la rareté d'une carte en tenant compte du pity.
 *
 * Ordre de vérification du pity (du plus rare au moins rare) :
 *  1. Void hard pity  → si packsSinceVoid >= 500 → force VOID
 *  2. Legendary pity  → si packsSinceLegendary >= 50 → force LEGENDARY
 *  3. Roll normal pondéré
 */
export function rollRarity({ pityState = createPityState(), random = randomFloat, rarityWeights = null } = {}) {
  // Hard pity Void
  if (pityState.packsSinceVoid >= PITY_RULES.voidAfterPacks) {
    return RARITY_KEYS.VOID;
  }

  // Soft pity Legendary
  if (pityState.packsSinceLegendary >= PITY_RULES.legendaryAfterPacks) {
    return RARITY_KEYS.LEGENDARY;
  }

  // Roll pondéré normal
  const getWeight = (rarityKey) => Number(rarityWeights?.[rarityKey] ?? RARITIES[rarityKey]?.weight ?? 0);
  const totalWeight = RARITY_ORDER.reduce((sum, rarityKey) => sum + getWeight(rarityKey), 0);
  let cursor = random() * totalWeight;

  for (const rarityKey of RARITY_ORDER) {
    cursor -= getWeight(rarityKey);
    if (cursor <= 0) return rarityKey;
  }

  return RARITY_KEYS.COMMON;
}

// ─────────────────────────────────────────────
// PICK CARTE
// ─────────────────────────────────────────────

function pickCardFromRarity(rarityKey, { pool = CARD_POOL, excludedIds = new Set(), random = randomFloat } = {}) {
  const safePool = Array.isArray(pool) ? pool.filter(Boolean) : [];

  if (safePool.length === 0) {
    throw new Error('Aucune carte disponible. Ajoute des cartes dans l\'admin avant d\'ouvrir un pack.');
  }

  const available = getCardsByRarity(rarityKey, safePool);
  const rarityCandidates = available.length > 0 ? available : safePool;
  const nonDuplicates = rarityCandidates.filter((card) => !excludedIds.has(card.id));
  const candidates = nonDuplicates.length > 0 ? nonDuplicates : rarityCandidates;

  const index = Math.floor(random() * candidates.length);
  return candidates[index];
}

// ─────────────────────────────────────────────
// HYDRATATION CARTE
// ─────────────────────────────────────────────

export function hydrateCard(card) {
  const rarity = RARITIES[card.rarity];
  const family = getFam(card.family);

  return Object.freeze({
    ...card,
    family,
    familyKey: family.key,
    rarity,
    rarityKey: rarity.key,
  });
}

// ─────────────────────────────────────────────
// ROLL CARTE
// ─────────────────────────────────────────────

export function rollCard({
  pityState = createPityState(),
  pool = CARD_POOL,
  excludedIds = new Set(),
  random = randomFloat,
  rarityWeights = null,
} = {}) {
  const rarityKey = rollRarity({ pityState, random, rarityWeights });
  const card = pickCardFromRarity(rarityKey, { pool, excludedIds, random });
  return hydrateCard(card);
}

// ─────────────────────────────────────────────
// MISE À JOUR DU PITY APRÈS UN PACK
//
// Règles :
// - packsSinceLegendary resets si le pack contient au moins une Legendary ou Void
// - packsSinceVoid resets UNIQUEMENT si le pack contient au moins une Void
//   (pull Legendary ne réinitialise PAS le compteur Void)
// ─────────────────────────────────────────────

export function updatePityAfterPack(pityState, cards) {
  const hasLegendaryOrBetter = cards.some((card) =>
    isRarityAtLeast(card.rarityKey, RARITY_KEYS.LEGENDARY)
  );
  const hasVoid = cards.some((card) => card.rarityKey === RARITY_KEYS.VOID);

  return createPityState({
    packsSinceLegendary: hasLegendaryOrBetter ? 0 : pityState.packsSinceLegendary + 1,
    packsSinceVoid:      hasVoid               ? 0 : pityState.packsSinceVoid + 1,
  });
}

// ─────────────────────────────────────────────
// ROLL PACK COMPLET
// ─────────────────────────────────────────────

export function rollPack({
  size = DEFAULT_PACK_SIZE,
  pityState = createPityState(),
  pool = CARD_POOL,
  random = randomFloat,
  rarityWeights = null,
} = {}) {
  const excludedIds = new Set();
  const cards = [];

  for (let index = 0; index < size; index += 1) {
    const card = rollCard({ pityState, pool, excludedIds, random, rarityWeights });
    cards.push(card);
    excludedIds.add(card.id);
  }

  return Object.freeze({
    cards: Object.freeze(cards),
    highestRarity: getHighestRarity(cards)?.rarity ?? null,
    pityState: updatePityAfterPack(pityState, cards),
  });
}

// ─────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────

export function getHighestRarity(cards) {
  return cards.reduce((highest, card) => {
    if (!highest) return card;
    return getRarityRank(card.rarityKey) > getRarityRank(highest.rarityKey) ? card : highest;
  }, null);
}

export function getDropRates(rarityWeights = null) {
  const getWeight = (rarityKey) => Number(rarityWeights?.[rarityKey] ?? RARITIES[rarityKey]?.weight ?? 0);
  const totalWeight = RARITY_ORDER.reduce((sum, rarityKey) => sum + getWeight(rarityKey), 0);

  return RARITY_ORDER.map((rarityKey) => {
    const rarity = RARITIES[rarityKey];
    const weight = getWeight(rarityKey);
    return Object.freeze({
      rarity: rarity.key,
      label: rarity.label,
      percentage: totalWeight > 0 ? (weight / totalWeight) * 100 : 0,
      weight,
    });
  });
}

// ─────────────────────────────────────────────
// RUNTIME POOL (cartes custom admin)
// ─────────────────────────────────────────────

const CUSTOM_CARD_SOURCE = Object.freeze({ ADMIN: 'admin-custom' });
let customCardsRuntime = [];
let activeCardPoolRuntime = [];

function normalizeFamilyKey(value) {
  const key = String(value ?? 'global').trim().toLowerCase();
  // Valider contre les familles statiques d'abord
  if (getFam(key)) return key;
  // Accepter toute clé non-vide qui vient d'une famille dynamique (Supabase)
  // La validation stricte est faite côté admin au moment de la création
  if (key && key !== '') return key;
  return 'global';
}

function normalizeRarityKey(value) {
  const key = String(value ?? RARITY_KEYS.COMMON).trim().toLowerCase();
  return RARITIES[key] ? key : RARITY_KEYS.COMMON;
}

function normalizeCardLayers(value = {}) {
  const raw = value.layers ?? value.voidLayers ?? value.assets ?? {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return Object.freeze({});

  const pick = (...keys) => {
    for (const key of keys) {
      const current = raw[key] ?? value[key];
      if (typeof current === 'string' && current.trim()) return current.trim();
    }
    return null;
  };

  const layers = {
    background:  pick('background', 'bg', 'layer_background', 'layerBackground'),
    character:   pick('character', 'subject', 'layer_character', 'layerCharacter'),
    energy:      pick('energy', 'fx', 'layer_energy', 'layerEnergy'),
    foreground:  pick('foreground', 'front', 'shards', 'layer_foreground', 'layerForeground'),
    particles:   pick('particles', 'particle', 'layer_particles', 'layerParticles'),
  };

  return Object.freeze(Object.fromEntries(Object.entries(layers).filter(([, url]) => Boolean(url))));
}

export function normalizeCustomCard(row = {}) {
  const data = row.data ?? row.metadata ?? row;
  const id = String(row.card_id ?? row.id ?? data.id ?? '').trim();
  const rarity = normalizeRarityKey(row.rarity ?? data.rarity);
  const family = normalizeFamilyKey(row.family ?? data.family);
  const layers = normalizeCardLayers(data);

  return Object.freeze({
    id,
    name:      String(row.name ?? data.name ?? 'Carte sans nom').trim() || 'Carte sans nom',
    rarity,
    family,
    character: String(row.character ?? data.character ?? row.subtitle ?? data.subtitle ?? '').trim() || 'Signal inconnu',
    image:     String(row.image_url ?? row.image ?? data.image_url ?? data.image ?? '').trim() || null,
    layers,
    hasLayers: Object.keys(layers).length > 0,
    source:    row.source ?? data.source ?? CUSTOM_CARD_SOURCE.ADMIN,
    metadata:  { ...data, layers },
  });
}

export function setCustomCards(cards = []) {
  const normalized = cards
    .map(normalizeCustomCard)
    .filter((card) => card.id && RARITIES[card.rarity]);

  customCardsRuntime = normalized;
  activeCardPoolRuntime = [...normalized];
  return getActiveCardPool();
}

export function getCustomCards() {
  return Object.freeze([...customCardsRuntime]);
}

export function getActiveCardPool() {
  return Object.freeze([...activeCardPoolRuntime]);
}

export function findCardInActivePool(cardId) {
  return getActiveCardPool().find((card) => card.id === cardId) ?? null;
}
