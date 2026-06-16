/**
 * trade-service.js — Système de trade entre joueurs
 */

export async function sendTradeOffer({
  receiverId, offeredCardId, offeredCardKey, offeredRarity,
  wantedCardKey, wantedCardName, wantedRarity, message = '',
}) {
  const res = await fetch('/api/trade', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ receiverId, offeredCardId, offeredCardKey, offeredRarity, wantedCardKey, wantedCardName, wantedRarity, message }),
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function acceptTrade(tradeId) {
  const res = await fetch(`/api/trade/${tradeId}/accept`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function declineTrade(tradeId) {
  const res = await fetch(`/api/trade/${tradeId}/decline`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
}

export async function cancelTrade(tradeId) {
  const res = await fetch(`/api/trade/${tradeId}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
}

export async function getPendingTrades() {
  const res = await fetch('/api/trade?status=pending');
  if (!res.ok) return [];
  return await res.json();
}

export async function getFriendCollection(friendId) {
  const res = await fetch(`/api/collection?userId=${friendId}`);
  if (!res.ok) return [];
  return await res.json();
}

export async function getMyCollection() {
  const res = await fetch('/api/collection');
  if (!res.ok) return [];
  return await res.json();
}

export function subscribeToTrades(myUserId, onTrade) {
  const interval = setInterval(async () => {
    try {
      const trades = await getPendingTrades();
      for (const t of trades) onTrade(t);
    } catch {}
  }, 5000);
  return () => clearInterval(interval);
}
