/**
 * social-service.js — Amis, messages directs, défis PvP
 * Remplace les appels Supabase par des fetch vers les API routes.
 * Les abonnements temps-réel deviennent du polling simple.
 */

// ── Amis ──────────────────────────────────────────────────────────────

export async function getFriends() {
  const res = await fetch('/api/social/friends');
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function sendFriendRequest(receiverId) {
  const res = await fetch('/api/social/friends', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ receiverId }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function respondFriendRequest(friendshipId, accept) {
  const res = await fetch('/api/social/friends', {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ friendshipId, accept }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function removeFriend(friendshipId) {
  const res = await fetch('/api/social/friends', {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ friendshipId }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function searchPlayer(query) {
  if (!query || query.length < 2) return [];
  const res = await fetch(`/api/social/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  return await res.json();
}

// ── Messages ──────────────────────────────────────────────────────────

export async function getConversation(otherUserId, limit = 50) {
  const res = await fetch(`/api/social/messages?with=${otherUserId}&limit=${limit}`);
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function sendMessage(receiverId, content) {
  const res = await fetch('/api/social/messages', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ receiverId, content }),
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function markMessagesRead(senderId) {
  await fetch(`/api/social/messages/read`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ senderId }),
  });
}

// Polling à la place du temps réel Supabase
export function subscribeToMessages(myUserId, onMessage) {
  let lastId = null;
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/api/social/messages/poll?userId=${myUserId}&after=${lastId ?? ''}`);
      if (!res.ok) return;
      const msgs = await res.json();
      for (const msg of msgs) {
        if (!lastId || msg.id > lastId) lastId = msg.id;
        onMessage(msg);
      }
    } catch {}
  }, 3000);
  return () => clearInterval(interval);
}

// ── Défis PvP ─────────────────────────────────────────────────────────

export async function sendChallenge(challengedId, deck) {
  const res = await fetch('/api/combat/challenges', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ challengedId, deck }),
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function acceptChallenge(challengeId, deck) {
  const res = await fetch(`/api/combat/challenges/${challengeId}/accept`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ deck }),
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function declineChallenge(challengeId) {
  await fetch(`/api/combat/challenges/${challengeId}/decline`, { method: 'POST' });
}

export async function getPendingChallenges() {
  const res = await fetch('/api/combat/challenges?status=pending');
  if (!res.ok) return [];
  return await res.json();
}

export function subscribeToChallenges(myUserId, onChallenge) {
  const interval = setInterval(async () => {
    try {
      const challenges = await getPendingChallenges();
      for (const c of challenges) onChallenge(c);
    } catch {}
  }, 5000);
  return () => clearInterval(interval);
}

export function subscribeToChallenge(challengeId, onUpdate) {
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/api/combat/challenges/${challengeId}`);
      if (res.ok) onUpdate(await res.json());
    } catch {}
  }, 2000);
  return () => clearInterval(interval);
}
