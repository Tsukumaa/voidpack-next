/**
 * ladder-service.js
 * Ladder collection + Ladder combat
 */
import { getSupabaseClient } from '@/lib/supabase/client';

let _sb = null;
async function sb() { return _sb || (_sb = await getSupabaseClient()); }

// Définition des rangs combat
export const RANKS = [
  { id: 'void',     label: 'VOID',     min: 2000, color: '#a855f7', icon: '🌌' },
  { id: 'diamond',  label: 'Diamant',  min: 1500, color: '#00f3ff', icon: '💎' },
  { id: 'platinum', label: 'Platine',  min: 1000, color: '#e2e8f0', icon: '⭐' },
  { id: 'gold',     label: 'Or',       min: 600,  color: '#f59e0b', icon: '🥇' },
  { id: 'silver',   label: 'Argent',   min: 300,  color: '#94a3b8', icon: '🥈' },
  { id: 'bronze',   label: 'Bronze',   min: 0,    color: '#b45309', icon: '🥉' },
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

// ── Ladder collection ─────────────────────────────────────────────────
export async function getCollectionLadder(limit = 50) {
  const client = await sb();
  const { data, error } = await client.rpc('get_collection_ladder', { p_limit: limit });
  if (error) throw error;
  return data ?? [];
}

// ── Ladder combat ──────────────────────────────────────────────────────
export async function getCombatLadder(limit = 50) {
  const client = await sb();
  const { data, error } = await client.rpc('get_combat_ladder', { p_limit: limit });
  if (error) throw error;
  return data ?? [];
}

// ── Stats combat du joueur connecté ───────────────────────────────────
export async function getMyCombatStats() {
  const client = await sb();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await client
    .from('combat_stats')
    .select('*')
    .eq('user_id', user.id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ── Saison active ─────────────────────────────────────────────────────
export async function getActiveSeason() {
  const client = await sb();
  const { data, error } = await client
    .from('combat_seasons')
    .select('*')
    .eq('is_active', true)
    .order('started_at', { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data;
}

// ── Enregistrer un résultat de combat ─────────────────────────────────
export async function recordCombatResult(sessionId, winnerId) {
  const client = await sb();
  const { error } = await client.rpc('record_combat_result', {
    p_session_id: sessionId,
    p_winner_id:  winnerId,
  });
  if (error) throw error;
}
