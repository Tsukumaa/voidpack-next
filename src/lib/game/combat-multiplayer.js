/**
 * combat-multiplayer.js
 * Combat multijoueur via polling (remplace Supabase Realtime).
 */

let _session  = null;
let _myRole   = null;
let _onUpdate = null;
let _onAction = null;
let _pollInterval = null;
let _lastActionSeq = 0;

export function getMyRole()  { return _myRole; }
export function getSession() { return _session; }
export function isMyTurn() {
  if (!_session || !_myRole) return false;
  const myId = _myRole === 'player1' ? _session.player1_id : _session.player2_id;
  return _session.current_turn === myId;
}

export function getOpponentId() {
  if (!_session || !_myRole) return null;
  return _myRole === 'player1' ? _session.player2_id : _session.player1_id;
}

export function getMyId() {
  if (!_session || !_myRole) return null;
  return _myRole === 'player1' ? _session.player1_id : _session.player2_id;
}

export function onSessionUpdate(cb) { _onUpdate = cb; }
export function onOpponentAction(cb) { _onAction = cb; }

// ── Matchmaking ───────────────────────────────────────────────────────

export async function joinMatchmaking(deck, { onMatched, onWaiting } = {}) {
  const deckPayload = deck.map(e => ({
    id: e.id, name: e.name, rarity: e.rarity,
    family: e.family, qty: e.qty,
    combat: e.metadata?.combat ?? { atk: 1, hp: 2, cost: 1, effects: [] },
  }));

  const res = await fetch('/api/combat/matchmaking', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ deck: deckPayload }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();

  if (data.status === 'matched') {
    _myRole  = data.you_are;
    _session = data.session;
    _startPolling(data.session.id);
    onMatched?.(data);
  } else {
    onWaiting?.();
    // Poll matchmaking queue for a match
    const pollMatch = setInterval(async () => {
      try {
        const r = await fetch('/api/combat/matchmaking/status');
        if (!r.ok) return;
        const d = await r.json();
        if (d.status === 'matched') {
          clearInterval(pollMatch);
          _myRole  = d.you_are;
          _session = d.session;
          _startPolling(d.session.id);
          onMatched?.(d);
        }
      } catch {}
    }, 2000);
  }
  return data;
}

export async function leaveMatchmaking() {
  await fetch('/api/combat/matchmaking', { method: 'DELETE' });
  cleanupSession();
}

// ── Polling ───────────────────────────────────────────────────────────

function _startPolling(sessionId) {
  if (_pollInterval) clearInterval(_pollInterval);
  _lastActionSeq = 0;

  _pollInterval = setInterval(async () => {
    try {
      const [sessRes, actRes] = await Promise.all([
        fetch(`/api/combat/session/${sessionId}`),
        fetch(`/api/combat/session/${sessionId}/actions?after=${_lastActionSeq}`),
      ]);

      if (sessRes.ok) {
        const newSession = await sessRes.json();
        if (JSON.stringify(newSession) !== JSON.stringify(_session)) {
          _session = newSession;
          _onUpdate?.(_session);
        }
      }

      if (actRes.ok) {
        const actions = await actRes.json();
        const myId = getMyId();
        for (const action of actions) {
          if (action.seq > _lastActionSeq) _lastActionSeq = action.seq;
          if (action.player_id !== myId) _onAction?.(action);
        }
      }
    } catch {}
  }, 1500);
}

// ── Actions ───────────────────────────────────────────────────────────

export async function submitAction(actionType, payload = {}, newState = null) {
  if (!_session || !isMyTurn()) throw new Error('Pas ton tour');

  const res = await fetch(`/api/combat/session/${_session.id}/action`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ actionType, payload, newState }),
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function endTurn(gameState) {
  return submitAction('end_turn', {}, gameState);
}

export async function surrender() {
  return submitAction('surrender', {});
}

export async function finishGame(winnerId) {
  const res = await fetch(`/api/combat/session/${_session.id}/finish`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ winnerId }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export function cleanupSession() {
  if (_pollInterval) clearInterval(_pollInterval);
  _pollInterval = null;
  _session  = null;
  _myRole   = null;
  _onUpdate = null;
  _onAction = null;
  _lastActionSeq = 0;
}

export function initSession(session, myUserId) {
  _session = session;
  _myRole  = session.player1_id === myUserId ? 'player1' : 'player2';
  _startPolling(session.id);
}
