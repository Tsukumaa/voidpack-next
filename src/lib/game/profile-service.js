const EMPTY_PROFILE = Object.freeze({
  level: 1,
  xp: 0,
  packsOpened: 0,
  highestRarity: null,
  voidPulls: 0,
  currentStreak: 0,
  bestStreak: 0
});

function normalizeProfile(row = {}) {
  return Object.freeze({
    userId:        row.userId        || row.user_id       || null,
    username:      row.username                           || 'Unknown',
    avatarUrl:     row.avatarUrl     || row.avatar_url    || null,
    level:         Number(row.level)                      || 1,
    xp:            Number(row.xp)                        || 0,
    packsOpened:   Number(row.packsOpened  ?? row.packs_opened)  || 0,
    highestRarity: row.highestRarity ?? row.highest_rarity ?? null,
    voidPulls:     Number(row.voidPulls    ?? row.void_pulls)    || 0,
    currentStreak: Number(row.currentStreak ?? row.current_streak) || 0,
    bestStreak:    Number(row.bestStreak    ?? row.best_streak)   || 0,
    twitchId:      row.twitchId    ?? row.twitch_id    ?? null,
    twitchLogin:   row.twitchLogin ?? row.twitch_login ?? null,
  });
}

function createGuestProfileResult(source = 'guest') {
  return Object.freeze({ profile: EMPTY_PROFILE, source });
}

export async function getOrCreatePlayerProfile() {
  try {
    const res = await fetch('/api/profile');
    if (res.status === 401) return createGuestProfileResult('guest');
    if (!res.ok) return createGuestProfileResult('load_failed');
    const data = await res.json();
    return Object.freeze({ profile: normalizeProfile(data), source: 'database' });
  } catch {
    return createGuestProfileResult('exception');
  }
}

export async function updatePlayerProfile(_userId, patch = {}) {
  try {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return Object.freeze({ updated: false, reason: 'UPDATE_FAILED' });
    const data = await res.json();
    return Object.freeze({ updated: true, profile: normalizeProfile(data) });
  } catch {
    return Object.freeze({ updated: false, reason: 'UPDATE_EXCEPTION' });
  }
}
