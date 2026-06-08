-- ═══════════════════════════════════════════════════════════════════════
-- VOID Pack — Système social : amis, chat, défis
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Amitiés
create table if not exists public.friendships (
  id          bigserial primary key,
  sender_id   uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending'
    check (status in ('pending', 'accepted', 'blocked')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(sender_id, receiver_id)
);

create index if not exists idx_friendships_receiver on public.friendships(receiver_id, status);
create index if not exists idx_friendships_sender   on public.friendships(sender_id,   status);

-- 2. Messages directs
create table if not exists public.direct_messages (
  id           bigserial primary key,
  sender_id    uuid not null references auth.users(id) on delete cascade,
  receiver_id  uuid not null references auth.users(id) on delete cascade,
  content      text not null check (char_length(content) <= 500),
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_dm_conversation on public.direct_messages(
  least(sender_id::text, receiver_id::text),
  greatest(sender_id::text, receiver_id::text),
  created_at
);

-- 3. Défis PvP
create table if not exists public.game_challenges (
  id           uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users(id) on delete cascade,
  challenged_id uuid not null references auth.users(id) on delete cascade,
  deck          jsonb not null,
  status        text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired')),
  session_id    uuid references public.game_sessions(id),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '2 minutes'
);

create index if not exists idx_challenges_challenged on public.game_challenges(challenged_id, status);

-- 4. RLS
alter table public.friendships       enable row level security;
alter table public.direct_messages   enable row level security;
alter table public.game_challenges   enable row level security;

-- Friendships
create policy "see own friendships" on public.friendships
  for select using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy "send friend request" on public.friendships
  for insert with check (sender_id = auth.uid());
create policy "update own friendships" on public.friendships
  for update using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy "delete own friendships" on public.friendships
  for delete using (sender_id = auth.uid() or receiver_id = auth.uid());

-- Messages
create policy "see own messages" on public.direct_messages
  for select using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy "send message" on public.direct_messages
  for insert with check (sender_id = auth.uid());
create policy "mark read" on public.direct_messages
  for update using (receiver_id = auth.uid());

-- Défis
create policy "see own challenges" on public.game_challenges
  for select using (challenger_id = auth.uid() or challenged_id = auth.uid());
create policy "send challenge" on public.game_challenges
  for insert with check (challenger_id = auth.uid());
create policy "update challenge" on public.game_challenges
  for update using (challenger_id = auth.uid() or challenged_id = auth.uid());

-- 5. Realtime
alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.direct_messages;
alter publication supabase_realtime add table public.game_challenges;

-- 6. RPC : liste d'amis avec profil
create or replace function public.get_friends()
returns table (
  friendship_id bigint,
  status        text,
  direction     text,
  user_id       uuid,
  username      text,
  avatar_url    text,
  level         integer,
  created_at    timestamptz
)
language sql security definer
as $$
  select
    f.id,
    f.status,
    case when f.sender_id = auth.uid() then 'sent' else 'received' end,
    case when f.sender_id = auth.uid() then f.receiver_id else f.sender_id end,
    pp.username,
    pp.avatar_url,
    pp.level,
    f.created_at
  from public.friendships f
  join public.player_profiles pp
    on pp.user_id = case when f.sender_id = auth.uid() then f.receiver_id else f.sender_id end
  where f.sender_id = auth.uid() or f.receiver_id = auth.uid()
  order by f.status = 'accepted' desc, f.created_at desc;
$$;

-- 7. RPC : chercher un joueur par username
create or replace function public.search_player(p_query text)
returns table (
  user_id    uuid,
  username   text,
  avatar_url text,
  level      integer
)
language sql security definer
as $$
  select user_id, username, avatar_url, level
  from public.player_profiles
  where username ilike '%' || p_query || '%'
    and user_id != auth.uid()
  limit 10;
$$;

-- 8. RPC : conversation entre deux joueurs
create or replace function public.get_conversation(p_other_id uuid, p_limit int default 50)
returns table (
  id          bigint,
  sender_id   uuid,
  content     text,
  read_at     timestamptz,
  created_at  timestamptz
)
language sql security definer
as $$
  select id, sender_id, content, read_at, created_at
  from public.direct_messages
  where (sender_id = auth.uid() and receiver_id = p_other_id)
     or (sender_id = p_other_id and receiver_id = auth.uid())
  order by created_at desc
  limit p_limit;
$$;

-- 9. RPC : marquer les messages comme lus
create or replace function public.mark_messages_read(p_sender_id uuid)
returns void
language sql security definer
as $$
  update public.direct_messages
  set read_at = now()
  where sender_id = p_sender_id
    and receiver_id = auth.uid()
    and read_at is null;
$$;

-- 10. RPC : accepter un défi et créer la session
create or replace function public.accept_challenge(p_challenge_id uuid, p_deck jsonb)
returns jsonb
language plpgsql security definer
as $$
declare
  v_challenge public.game_challenges;
  v_sess_id   uuid;
begin
  select * into v_challenge
  from public.game_challenges
  where id = p_challenge_id
    and challenged_id = auth.uid()
    and status = 'pending'
    and expires_at > now();

  if not found then
    return jsonb_build_object('error', 'challenge_not_found_or_expired');
  end if;

  -- Créer la session de combat
  insert into public.game_sessions
    (player1_id, player2_id, status, current_turn, state)
  values (
    v_challenge.challenger_id, auth.uid(), 'active', v_challenge.challenger_id,
    jsonb_build_object(
      'p1_hp', 30, 'p2_hp', 30,
      'p1_mana', 1, 'p1_max_mana', 1,
      'p2_mana', 0, 'p2_max_mana', 0,
      'p1_board', '[]'::jsonb, 'p2_board', '[]'::jsonb,
      'p1_deck', v_challenge.deck, 'p2_deck', p_deck,
      'turn', 1
    )
  )
  returning id into v_sess_id;

  -- Mettre à jour le défi
  update public.game_challenges
  set status = 'accepted', session_id = v_sess_id
  where id = p_challenge_id;

  return jsonb_build_object(
    'status', 'accepted',
    'session_id', v_sess_id,
    'you_are', 'player2'
  );
end;
$$;
