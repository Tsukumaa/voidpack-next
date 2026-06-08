/**
 * trade-service.js
 * Système de trade entre joueurs
 */
import { getSupabaseClient } from '@/lib/supabase/client';

let _sb = null;
async function sb() { return _sb || (_sb = await getSupabaseClient()); }

// ── Créer une offre de trade ───────────────────────────────────────────
export async function sendTradeOffer({
  receiverId,
  offeredCardId,    // UUID de la player_card
  offeredCardKey,   // card_id lisible
  offeredRarity,
  wantedCardKey,    // card_id demandé
  wantedCardName,
  wantedRarity,
  message = '',
}) {
  const client = await sb();
  const { data, error } = await client
    .from('trade_offers')
    .insert({
      receiver_id:      receiverId,
      offered_card_id:  offeredCardId,
      offered_card_key: offeredCardKey,
      offered_rarity:   offeredRarity,
      wanted_card_key:  wantedCardKey,
      wanted_card_name: wantedCardName,
      wanted_rarity:    wantedRarity,
      message:          message.trim().slice(0, 200),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Accepter un trade ──────────────────────────────────────────────────
export async function acceptTrade(tradeId) {
  const client = await sb();
  const { data, error } = await client.rpc('accept_trade', { p_trade_id: tradeId });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// ── Refuser un trade ───────────────────────────────────────────────────
export async function declineTrade(tradeId) {
  const client = await sb();
  const { error } = await client.rpc('decline_trade', { p_trade_id: tradeId });
  if (error) throw error;
}

// ── Annuler un trade ───────────────────────────────────────────────────
export async function cancelTrade(tradeId) {
  const client = await sb();
  const { error } = await client.rpc('cancel_trade', { p_trade_id: tradeId });
  if (error) throw error;
}

// ── Trades en attente ──────────────────────────────────────────────────
export async function getPendingTrades() {
  const client = await sb();
  const { data, error } = await client.rpc('get_pending_trades');
  if (error) throw error;
  return data ?? [];
}

// ── Collection d'un ami ────────────────────────────────────────────────
export async function getFriendCollection(friendId) {
  const client = await sb();
  const { data, error } = await client.rpc('get_friend_collection', { p_friend_id: friendId });
  if (error) throw error;
  return data ?? [];
}

// ── Ma collection (pour choisir ce que j'offre) ───────────────────────
export async function getMyCollection() {
  const client = await sb();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];
  const { data, error } = await client
    .from('player_cards')
    .select('id, card_id, rarity, family, metadata, obtained_at')
    .eq('user_id', user.id)
    .order('obtained_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── Écouter les trades entrants ────────────────────────────────────────
export function subscribeToTrades(myUserId, onTrade) {
  let channel;
  sb().then(client => {
    channel = client
      .channel(`trades:${myUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'trade_offers',
        filter: `receiver_id=eq.${myUserId}`,
      }, (payload) => onTrade(payload.new))
      .subscribe();
  });
  return () => channel?.unsubscribe();
}
