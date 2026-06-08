-- ═══════════════════════════════════════════════════════════════════════
-- VOID Pack — Système de combat multijoueur
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Parties en cours
create table if not exists public.game_sessions (
  id              uuid primary key default gen_random_uuid(),
  player1_id      uuid not null references auth.users(id) on delete cascade,
  player2_id      uuid references auth.users(id) on delete cascade,
  status          text not null default 'waiting'
    check (status in ('waiting', 'active', 'finished', 'abandoned')),
  current_turn    uuid,
  turn_number     integer not null default 1,
  state           jsonb not null default '{}',
  winner_id       uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  finished_at     timestamptz
);

create index if not exists idx_game_sessions_waiting
  on public.game_sessions(status, created_at)
  where status = 'waiting';

create index if not exists idx_game_sessions_p1
  on public.game_sessions(player1_id, status);

create index if not exists idx_game_sessions_p2
  on public.game_sessions(player2_id, status);

-- 2. Actions de jeu
create table if not exists public.game_actions (
  id              bigserial primary key,
  session_id      uuid not null references public.game_sessions(id) on delete cascade,
  player_id       uuid not null references auth.users(id),
  action_type     text not null,
  payload         jsonb not null default '{}',
  turn_number     integer not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_game_actions_session
  on public.game_actions(session_id, created_at);

-- 3. File matchmaking
create table if not exists public.matchmaking_queue (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  deck            jsonb not null,
  joined_at       timestamptz not null default now()
);

-- 4. RLS
alter table public.game_sessions      enable row level security;
alter table public.game_actions       enable row level security;
alter table public.matchmaking_queue  enable row level security;

create policy "players see own sessions" on public.game_sessions
  for select using (player1_id = auth.uid() or player2_id = auth.uid());

create policy "players update own sessions" on public.game_sessions
  for update using (player1_id = auth.uid() or player2_id = auth.uid());

create policy "player1 insert session" on public.game_sessions
  for insert with check (player1_id = auth.uid());

create policy "players see game actions" on public.game_actions
  for select using (
    exists (
      select 1 from public.game_sessions s
      where s.id = session_id
        and (s.player1_id = auth.uid() or s.player2_id = auth.uid())
    )
  );

create policy "players insert game actions" on public.game_actions
  for insert with check (player_id = auth.uid());

create policy "own queue entry" on public.matchmaking_queue
  for all using (user_id = auth.uid());

-- 5. Realtime
alter publication supabase_realtime add table public.game_sessions;
alter publication supabase_realtime add table public.game_actions;

-- 6. RPC : rejoindre la queue ou matcher
create or replace function public.join_matchmaking(p_deck jsonb)
returns jsonb
language plpgsql security definer
as $$
declare
  v_opp_id   uuid;
  v_opp_deck jsonb;
  v_sess_id  uuid;
begin
  select user_id, deck into v_opp_id, v_opp_deck
  from public.matchmaking_queue
  where user_id != auth.uid()
  order by joined_at asc
  limit 1;

  if found then
    delete from public.matchmaking_queue where user_id = v_opp_id;

    insert into public.game_sessions
      (player1_id, player2_id, status, current_turn, state)
    values (
      v_opp_id, auth.uid(), 'active', v_opp_id,
      jsonb_build_object(
        'p1_hp', 30, 'p2_hp', 30,
        'p1_mana', 1, 'p1_max_mana', 1,
        'p2_mana', 0, 'p2_max_mana', 0,
        'p1_board', '[]'::jsonb,
        'p2_board', '[]'::jsonb,
        'p1_deck', v_opp_deck,
        'p2_deck', p_deck,
        'turn', 1
      )
    )
    returning id into v_sess_id;

    return jsonb_build_object(
      'status', 'matched',
      'session_id', v_sess_id,
      'opponent_id', v_opp_id,
      'you_are', 'player2'
    );
  else
    insert into public.matchmaking_queue (user_id, deck)
    values (auth.uid(), p_deck)
    on conflict (user_id) do update set deck = p_deck, joined_at = now();

    return jsonb_build_object('status', 'waiting');
  end if;
end;
$$;

-- 7. RPC : quitter la queue
create or replace function public.leave_matchmaking()
returns void language sql security definer
as $$
  delete from public.matchmaking_queue where user_id = auth.uid();
$$;

-- 8. RPC : soumettre une action
create or replace function public.submit_game_action(
  p_session_id  uuid,
  p_action_type text,
  p_payload     jsonb,
  p_new_state   jsonb default null
)
returns jsonb
language plpgsql security definer
as $$
declare
  v_session    public.game_sessions;
  v_is_p1      boolean;
  v_opp_id     uuid;
begin
  select * into v_session
  from public.game_sessions
  where id = p_session_id
    and status = 'active'
    and current_turn = auth.uid();

  if not found then
    return jsonb_build_object('error', 'not_your_turn');
  end if;

  v_is_p1  := v_session.player1_id = auth.uid();
  v_opp_id := case when v_is_p1 then v_session.player2_id else v_session.player1_id end;

  insert into public.game_actions (session_id, player_id, action_type, payload, turn_number)
  values (p_session_id, auth.uid(), p_action_type, p_payload, v_session.turn_number);

  if p_action_type = 'end_turn' then
    update public.game_sessions
    set current_turn = v_opp_id,
        turn_number  = turn_number + 1,
        state        = coalesce(p_new_state, state),
        updated_at   = now()
    where id = p_session_id;

  elsif p_action_type = 'surrender' then
    update public.game_sessions
    set status = 'finished', winner_id = v_opp_id,
        finished_at = now(), updated_at = now()
    where id = p_session_id;

  else
    update public.game_sessions
    set state = coalesce(p_new_state, state), updated_at = now()
    where id = p_session_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- 9. RPC : terminer une partie
create or replace function public.finish_game(
  p_session_id uuid,
  p_winner_id  uuid
)
returns void
language plpgsql security definer
as $$
begin
  update public.game_sessions
  set status = 'finished', winner_id = p_winner_id,
      finished_at = now(), updated_at = now()
  where id = p_session_id
    and (player1_id = auth.uid() or player2_id = auth.uid());
end;
$$;
