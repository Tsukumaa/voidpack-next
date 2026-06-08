/**
 * social-service.js
 * Amis, messages directs, défis PvP
 */
import { getSupabaseClient } from '@/lib/supabase/client';

let _sb = null;
async function sb() { return _sb || (_sb = await getSupabaseClient()); }

// ── Amis ──────────────────────────────────────────────────────────────

export async function getFriends() {
  const client = await sb();
  const { data, error } = await client.rpc('get_friends');
  if (error) throw error;
  return data ?? [];
}

export async function sendFriendRequest(receiverId) {
  const client = await sb();
  const { error } = await client.from('friendships').insert({
    sender_id: (await client.auth.getUser()).data.user?.id,
    receiver_id: receiverId,
  });
  if (error) throw error;
}

export async function respondFriendRequest(friendshipId, accept) {
  const client = await sb();
  const { error } = await client
    .from('friendships')
    .update({ status: accept ? 'accepted' : 'blocked', updated_at: new Date().toISOString() })
    .eq('id', friendshipId);
  if (error) throw error;
}

export async function removeFriend(friendshipId) {
  const client = await sb();
  const { error } = await client.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}

export async function searchPlayer(query) {
  if (!query || query.length < 2) return [];
  const client = await sb();
  const { data, error } = await client.rpc('search_player', { p_query: query });
  if (error) throw error;
  return data ?? [];
}

// ── Messages ──────────────────────────────────────────────────────────

export async function getConversation(otherUserId, limit = 50) {
  const client = await sb();
  const { data, error } = await client.rpc('get_conversation', {
    p_other_id: otherUserId,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []).reverse();
}

export async function sendMessage(receiverId, content) {
  const client = await sb();
  const user = (await client.auth.getUser()).data.user;
  const { data, error } = await client.from('direct_messages').insert({
    sender_id: user.id,
    receiver_id: receiverId,
    content: content.trim().slice(0, 500),
  }).select().single();
  if (error) throw error;
  return data;
}

export async function markMessagesRead(senderId) {
  const client = await sb();
  await client.rpc('mark_messages_read', { p_sender_id: senderId });
}

// Écouter les nouveaux messages en temps réel
export function subscribeToMessages(myUserId, onMessage) {
  let channel;
  sb().then(client => {
    channel = client
      .channel(`dm:${myUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `receiver_id=eq.${myUserId}`,
      }, (payload) => onMessage(payload.new))
      .subscribe();
  });
  return () => channel?.unsubscribe();
}

// ── Défis PvP ─────────────────────────────────────────────────────────

export async function sendChallenge(challengedId, deck) {
  const client = await sb();
  const user = (await client.auth.getUser()).data.user;
  const { data, error } = await client.from('game_challenges').insert({
    challenger_id: user.id,
    challenged_id: challengedId,
    deck: deck.map(e => ({
      id: e.id, name: e.name, rarity: e.rarity,
      family: e.family, qty: e.qty,
      combat: e.metadata?.combat ?? { atk: 1, hp: 2, cost: 1, effects: [] },
    })),
  }).select().single();
  if (error) throw error;
  return data;
}

export async function acceptChallenge(challengeId, deck) {
  const client = await sb();
  const { data, error } = await client.rpc('accept_challenge', {
    p_challenge_id: challengeId,
    p_deck: deck.map(e => ({
      id: e.id, name: e.name, rarity: e.rarity,
      family: e.family, qty: e.qty,
      combat: e.metadata?.combat ?? { atk: 1, hp: 2, cost: 1, effects: [] },
    })),
  });
  if (error) throw error;
  return data;
}

export async function declineChallenge(challengeId) {
  const client = await sb();
  await client.from('game_challenges')
    .update({ status: 'declined' })
    .eq('id', challengeId);
}

export async function getPendingChallenges() {
  const client = await sb();
  const user = (await client.auth.getUser()).data.user;
  const { data, error } = await client
    .from('game_challenges')
    .select('*, player_profiles!challenger_id(username, avatar_url)')
    .eq('challenged_id', user.id)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString());
  if (error) throw error;
  return data ?? [];
}

// Écouter les défis entrants
export function subscribeToChallenges(myUserId, onChallenge) {
  let channel;
  sb().then(client => {
    channel = client
      .channel(`challenges:${myUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'game_challenges',
        filter: `challenged_id=eq.${myUserId}`,
      }, (payload) => onChallenge(payload.new))
      .subscribe();
  });
  return () => channel?.unsubscribe();
}

// Écouter les mises à jour d'un défi (accepté/refusé)
export function subscribeToChallenge(challengeId, onUpdate) {
  let channel;
  sb().then(client => {
    channel = client
      .channel(`challenge:${challengeId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_challenges',
        filter: `id=eq.${challengeId}`,
      }, (payload) => onUpdate(payload.new))
      .subscribe();
  });
  return () => channel?.unsubscribe();
}
