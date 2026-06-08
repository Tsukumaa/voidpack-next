/**
 * combat-multiplayer.js
 * Gestion du combat multijoueur via Supabase Realtime
 *
 * Architecture :
 * - Matchmaking via RPC join_matchmaking
 * - État de jeu synchronisé via game_sessions (jsonb state)
 * - Actions en temps réel via game_actions (Realtime)
 * - Chaque joueur valide ses propres actions côté client
 *   et soumet l'état résultant au serveur via submit_game_action
 */

import { getSupabaseClient } from '@/lib/supabase/client';

// ── État de la session multijoueur ────────────────────────────────────
let _session   = null;   // session Supabase actuelle
let _myRole    = null;   // 'player1' | 'player2'
let _channel   = null;   // canal Realtime
let _onUpdate  = null;   // callback quand l'état change
let _onAction  = null;   // callback quand l'adversaire joue une action
let _supabase  = null;

export function getMyRole()    { return _myRole; }
export function getSession()   { return _session; }
export function isMyTurn()     {
  if (!_session || !_myRole) return false;
  const myId = _myRole === 'player1' ? _session.player1_id : _session.player2_id;
  return _session.current_turn === myId;
}

// ── Matchmaking ───────────────────────────────────────────────────────

/**
 * Rejoindre la file d'attente avec un deck
 * Retourne { status: 'waiting' } ou { status: 'matched', session_id, you_are }
 */
export async function joinMatchmaking(deck, { onMatched, onWaiting } = {}) {
  _supabase = await getSupabaseClient();

  const deckPayload = deck.map(e => ({
    id: e.id, name: e.name, rarity: e.rarity,
    family: e.family, qty: e.qty,
    combat: e.metadata?.combat ?? { atk: 1, hp: 2, cost: 1, effects: [] },
  }));

  const { data, error } = await _supabase.rpc('join_matchmaking', {
    p_deck: deckPayload,
  });

  if (error) throw new Error(error.message);

  if (data.status === 'matched') {
    _myRole = data.you_are;
    await _loadSession(data.session_id);
    _subscribeToSession(data.session_id);
    onMatched?.(data);
    return data;
  } else {
    // En attente — écouter la table pour être notifié quand une partie commence
    _subscribeToQueue(onMatched);
    onWaiting?.();
    return data;
  }
}

/** Quitter la file d'attente */
export async function leaveMatchmaking() {
  _supabase = _supabase || await getSupabaseClient();
  await _supabase.rpc('leave_matchmaking');
  _channel?.unsubscribe();
  _channel = null;
}

// ── Session ───────────────────────────────────────────────────────────

async function _loadSession(sessionId) {
  const { data, error } = await _supabase
    .from('game_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) throw new Error(error.message);
  _session = data;
  return data;
}

/** S'abonner aux changements de la session et aux actions */
function _subscribeToSession(sessionId) {
  _channel?.unsubscribe();

  _channel = _supabase
    .channel(`game:${sessionId}`)
    // Changements d'état de la session (tour suivant, fin de partie)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'game_sessions',
      filter: `id=eq.${sessionId}`,
    }, (payload) => {
      _session = { ..._session, ...payload.new };
      _onUpdate?.(_session);
    })
    // Nouvelles actions de l'adversaire
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'game_actions',
      filter: `session_id=eq.${sessionId}`,
    }, (payload) => {
      const action = payload.new;
      // Ignorer mes propres actions
      const myId = _myRole === 'player1' ? _session?.player1_id : _session?.player2_id;
      if (action.player_id !== myId) {
        _onAction?.(action);
      }
    })
    .subscribe();
}

/** Écouter la queue pour détecter un match */
function _subscribeToQueue(onMatched) {
  _supabase.auth.getUser().then(async ({ data: { user } }) => {
    if (!user) return;

    _channel = _supabase
      .channel('matchmaking')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
      }, async (payload) => {
        const s = payload.new;
        if (
          (s.player1_id === user.id || s.player2_id === user.id) &&
          s.status === 'active'
        ) {
          _myRole = s.player1_id === user.id ? 'player1' : 'player2';
          await _loadSession(s.id);
          _subscribeToSession(s.id);
          _channel.unsubscribe();
          onMatched?.({ status: 'matched', session_id: s.id, you_are: _myRole });
        }
      })
      .subscribe();
  });
}

// ── Callbacks ─────────────────────────────────────────────────────────
export function onSessionUpdate(cb) { _onUpdate = cb; }
export function onOpponentAction(cb) { _onAction = cb; }

// ── Soumettre une action ───────────────────────────────────────────────

/**
 * Soumettre une action au serveur
 * @param {string} actionType - play_card | attack | attack_face | end_turn | surrender
 * @param {object} payload    - données spécifiques à l'action
 * @param {object} newState   - nouvel état du jeu (optionnel, pour end_turn)
 */
export async function submitAction(actionType, payload = {}, newState = null) {
  if (!_session || !isMyTurn()) {
    throw new Error('Pas ton tour');
  }

  _supabase = _supabase || await getSupabaseClient();

  const { data, error } = await _supabase.rpc('submit_game_action', {
    p_session_id:  _session.id,
    p_action_type: actionType,
    p_payload:     payload,
    p_new_state:   newState,
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  return data;
}

/** Fin de tour — soumet l'état complet pour synchronisation */
export async function endTurn(gameState) {
  return submitAction('end_turn', {}, gameState);
}

/** Reddition */
export async function surrender() {
  return submitAction('surrender', {});
}

/** Terminer la partie (quand un joueur gagne) */
export async function finishGame(winnerId) {
  _supabase = _supabase || await getSupabaseClient();
  await _supabase.rpc('finish_game', {
    p_session_id: _session.id,
    p_winner_id:  winnerId,
  });
}

/** Nettoyer la session */
export function cleanupSession() {
  _channel?.unsubscribe();
  _channel   = null;
  _session   = null;
  _myRole    = null;
  _onUpdate  = null;
  _onAction  = null;
}

/** Récupérer l'ID de l'adversaire */
export function getOpponentId() {
  if (!_session || !_myRole) return null;
  return _myRole === 'player1' ? _session.player2_id : _session.player1_id;
}

/** Récupérer mon ID dans la session */
export function getMyId() {
  if (!_session || !_myRole) return null;
  return _myRole === 'player1' ? _session.player1_id : _session.player2_id;
}
