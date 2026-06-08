const ACHIEVEMENT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "first_pack",
    title: "Premier signal",
    description: "Ouvrir ton premier pack.",
    category: "opening",
    target: 1,
    metric: "packsOpened"
  }),
  Object.freeze({
    id: "ten_packs",
    title: "Rituel d'ouverture",
    description: "Ouvrir 10 packs.",
    category: "opening",
    target: 10,
    metric: "packsOpened"
  }),
  Object.freeze({
    id: "first_rare",
    title: "Éclat rare",
    description: "Obtenir au moins une carte rare ou mieux.",
    category: "rarity",
    target: 1,
    metric: "rarePlusPulls"
  }),
  Object.freeze({
    id: "first_legendary",
    title: "Signature légendaire",
    description: "Obtenir une carte légendaire ou mieux.",
    category: "rarity",
    target: 1,
    metric: "legendaryPlusPulls"
  }),
  Object.freeze({
    id: "void_contact",
    title: "Contact VOID",
    description: "Obtenir une carte VOID.",
    category: "rarity",
    target: 1,
    metric: "voidPulls"
  }),
  Object.freeze({
    id: "collection_25",
    title: "Archive naissante",
    description: "Atteindre 25% de collection.",
    category: "collection",
    target: 25,
    metric: "collectionCompletion"
  }),
  Object.freeze({
    id: "collection_50",
    title: "Demi-collection",
    description: "Atteindre 50% de collection.",
    category: "collection",
    target: 50,
    metric: "collectionCompletion"
  }),
  Object.freeze({
    id: "daily_7",
    title: "Série hebdomadaire",
    description: "Atteindre 7 jours de streak.",
    category: "daily",
    target: 7,
    metric: "currentStreak"
  })
]);

const RARITY_ORDER = Object.freeze([
  "common",
  "rare",
  "epic",
  "legendary",
  "void"
]);

function getRarityIndex(rarity) {
  return RARITY_ORDER.indexOf(rarity);
}

function normalizeCard(card) {
  return Object.freeze({
    id: card?.id || card?.card_id || card?.slug || card?.name || null,
    rarity: card?.rarity || "common"
  });
}

export function createAchievementMetrics({
  collection = [],
  profile = {},
  dailyState = {},
  collectionSummary = {}
} = {}) {
  const cards = Array.isArray(collection) ? collection.map(normalizeCard) : [];

  const rarePlusPulls = cards.filter((card) => getRarityIndex(card.rarity) >= getRarityIndex("rare")).length;
  const legendaryPlusPulls = cards.filter((card) => getRarityIndex(card.rarity) >= getRarityIndex("legendary")).length;
  const voidPulls = cards.filter((card) => card.rarity === "void").length;

  return Object.freeze({
    packsOpened: Math.max(0, Number(profile?.packsOpened ?? profile?.packs_opened) || cards.length || 0),
    rarePlusPulls,
    legendaryPlusPulls,
    voidPulls: Math.max(0, Number(profile?.voidPulls ?? profile?.void_pulls) || voidPulls || 0),
    collectionCompletion: Math.max(0, Number(collectionSummary?.completionPercent) || 0),
    currentStreak: Math.max(0, Number(dailyState?.currentStreak ?? dailyState?.current_streak) || 0)
  });
}

export function evaluateAchievements(metrics = {}, definitions = ACHIEVEMENT_DEFINITIONS) {
  return Object.freeze(
    definitions.map((achievement) => {
      const value = Math.max(0, Number(metrics[achievement.metric]) || 0);
      const progress = achievement.target > 0
        ? Math.min(100, Math.round((value / achievement.target) * 100))
        : 0;

      return Object.freeze({
        ...achievement,
        value,
        progress,
        unlocked: value >= achievement.target
      });
    })
  );
}

export function createAchievementsSummary(payload = {}) {
  const metrics = createAchievementMetrics(payload);
  const achievements = evaluateAchievements(metrics);

  return Object.freeze({
    metrics,
    achievements,
    unlockedCount: achievements.filter((achievement) => achievement.unlocked).length,
    totalCount: achievements.length
  });
}

export { ACHIEVEMENT_DEFINITIONS };
