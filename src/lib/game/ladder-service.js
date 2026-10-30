export const RANKS = [
  { id: 'void',     label: 'VOID',    min: 2000, color: '#a855f7', icon: '🌌' },
  { id: 'diamond',  label: 'Diamant', min: 1500, color: '#00f3ff', icon: '💎' },
  { id: 'platinum', label: 'Platine', min: 1000, color: '#e2e8f0', icon: '⭐' },
  { id: 'gold',     label: 'Or',      min: 600,  color: '#f59e0b', icon: '🥇' },
  { id: 'silver',   label: 'Argent',  min: 300,  color: '#94a3b8', icon: '🥈' },
  { id: 'bronze',   label: 'Bronze',  min: 0,    color: '#b45309', icon: '🥉' },
];

export function getRankInfo(points) {
  return RANKS.find(r => points >= r.min) ?? RANKS[RANKS.length - 1];
}

export function getNextRank(points) {
  const idx = RANKS.findIndex(r => points >= r.min);
  return idx > 0 ? RANKS[idx - 1] : null;
}

export function getRankProgress(points) {
  const current = getRankInfo(points);
  const next    = getNextRank(points);
  if (!next) return { percent: 100, pointsInRank: points - current.min, pointsNeeded: 0 };
  const range = next.min - current.min;
  const inRank = points - current.min;
  return {
    percent:      Math.min(100, Math.round((inRank / range) * 100)),
    pointsInRank: inRank,
    pointsNeeded: next.min - points,
  };
}

export async function getCollectionLadder(limit = 50) {
  const res = await fetch(`/api/ladder?type=collection&limit=${limit}`);
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function getCombatLadder(limit = 50) {
  const res = await fetch(`/api/ladder?type=combat&limit=${limit}`);
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function getMyCombatStats() {
  const res = await fetch('/api/combat/stats');
  if (!res.ok) return null;
  return await res.json();
}

export async function getActiveSeason() {
  const res = await fetch('/api/combat/season');
  if (!res.ok) return null;
  return await res.json();
}

export async function recordCombatResult(sessionId, winnerId) {
  const res = await fetch('/api/combat/result', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ sessionId, winnerId }),
  });
  if (!res.ok) throw new Error(await res.text());
}
