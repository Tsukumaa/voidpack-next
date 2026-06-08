const XP_PER_LEVEL = Object.freeze({
  BASE: 100,
  GROWTH: 1.18
});

export function getXpForLevel(level) {
  const safeLevel = Math.max(1, Number(level) || 1);

  return Math.floor(
    XP_PER_LEVEL.BASE * Math.pow(safeLevel, XP_PER_LEVEL.GROWTH)
  );
}

export function calculateLevelFromXp(totalXp) {
  let level = 1;
  let remainingXp = Math.max(0, Number(totalXp) || 0);

  while (remainingXp >= getXpForLevel(level)) {
    remainingXp -= getXpForLevel(level);
    level += 1;
  }

  return Object.freeze({
    level,
    currentLevelXp: remainingXp,
    nextLevelXp: getXpForLevel(level)
  });
}

export function grantXp(profile, amount) {
  const safeAmount = Math.max(0, Number(amount) || 0);

  const updatedXp = (profile?.xp || 0) + safeAmount;

  return Object.freeze({
    ...profile,
    xp: updatedXp,
    progression: calculateLevelFromXp(updatedXp)
  });
}

export function getXpRewardFromRarity(rarity) {
  const rewards = Object.freeze({
    common: 5,
    rare: 30,
    epic: 80,
    legendary: 200,
    void: 1000
  });

  return rewards[rarity] || rewards.common;
}

export function createProgressionSummary(profile) {
  const xp = Math.max(0, Number(profile?.xp) || 0);
  const progression = calculateLevelFromXp(xp);
  const percent = progression.nextLevelXp > 0
    ? Math.min(100, Math.round((progression.currentLevelXp / progression.nextLevelXp) * 100))
    : 0;

  return Object.freeze({
    level: progression.level,
    xp,
    currentLevelXp: progression.currentLevelXp,
    nextLevelXp: progression.nextLevelXp,
    percent,
    packsOpened: Math.max(0, Number(profile?.packsOpened ?? profile?.packs_opened) || 0),
    voidPulls: Math.max(0, Number(profile?.voidPulls ?? profile?.void_pulls) || 0),
    highestRarity: profile?.highestRarity ?? profile?.highest_rarity ?? null
  });
}
