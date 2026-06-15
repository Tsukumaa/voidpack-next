-- =========================================================
-- VOID Pack — Schema initial complet
-- Généré le 2026-06-16 depuis les fichiers SQL éparpillés.
-- =========================================================

-- Extensions
create extension if not exists pgcrypto;

-- =========================================================
-- player_profiles
-- =========================================================
create table if not exists public.player_profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  username       text not null,
  avatar_url     text,
  level          integer not null default 1,
  xp             integer not null default 0,
  packs_opened   integer not null default 0,
  highest_rarity text,
  void_pulls     integer not null default 0,
  current_streak integer not null default 0,
  best_streak    integer not null default 0,
  twitch_id      text unique,
  twitch_login   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.player_profiles enable row level security;

drop policy if exists "player_profiles_select_own" on public.player_profiles;
create policy "player_profiles_select_own" on public.player_profiles
  for select using (auth.uid() = user_id);

drop policy if exists "player_profiles_insert_own" on public.player_profiles;
create policy "player_profiles_insert_own" on public.player_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "player_profiles_update_own" on public.player_profiles;
create policy "player_profiles_update_own" on public.player_profiles
  for update using (auth.uid() = user_id);

drop policy if exists "anyone can read profiles" on public.player_profiles;
create policy "anyone can read profiles" on public.player_profiles
  for select using (true);

create index if not exists player_profiles_updated_at_idx on public.player_profiles(updated_at desc);

-- =========================================================
-- player_cards
-- =========================================================
create table if not exists public.player_cards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  card_id     text not null,
  rarity      text not null check (rarity in ('common', 'rare', 'epic', 'legendary', 'void')),
  family      text not null default 'global',
  obtained_at timestamptz not null default now(),
  metadata    jsonb not null default '{}'::jsonb
);

alter table public.player_cards enable row level security;

drop policy if exists "Players can read their own cards" on public.player_cards;
create policy "Players can read their own cards" on public.player_cards
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Players can add their own cards" on public.player_cards;
create policy "Players can add their own cards" on public.player_cards
  for insert to authenticated with check (auth.uid() = user_id);

create index if not exists player_cards_user_id_idx      on public.player_cards (user_id);
create index if not exists player_cards_user_card_idx    on public.player_cards (user_id, card_id);
create index if not exists player_cards_user_family_idx  on public.player_cards (user_id, family);
create index if not exists player_cards_user_obtained_idx on public.player_cards (user_id, obtained_at desc);

grant select, insert on public.player_cards to authenticated;

-- =========================================================
-- player_achievements
-- =========================================================
create table if not exists public.player_achievements (
  user_id        uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null,
  unlocked_at    timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.player_achievements enable row level security;

drop policy if exists "player_achievements_select_own" on public.player_achievements;
create policy "player_achievements_select_own" on public.player_achievements
  for select using (auth.uid() = user_id);

drop policy if exists "player_achievements_insert_own" on public.player_achievements;
create policy "player_achievements_insert_own" on public.player_achievements
  for insert with check (auth.uid() = user_id);

create index if not exists player_achievements_unlocked_at_idx on public.player_achievements(unlocked_at desc);

-- =========================================================
-- opening_history
-- =========================================================
create table if not exists public.opening_history (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  card_id      text not null,
  rarity       text not null,
  booster_type text,
  created_at   timestamptz not null default now()
);

alter table public.opening_history enable row level security;

drop policy if exists "opening_history_select_own" on public.opening_history;
create policy "opening_history_select_own" on public.opening_history
  for select using (auth.uid() = user_id);

drop policy if exists "opening_history_insert_own" on public.opening_history;
create policy "opening_history_insert_own" on public.opening_history
  for insert with check (auth.uid() = user_id);

create index if not exists opening_history_user_id_idx   on public.opening_history(user_id);
create index if not exists opening_history_created_at_idx on public.opening_history(created_at desc);

-- =========================================================
-- player_pity_state
-- =========================================================
create table if not exists public.player_pity_state (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  packs_since_legendary integer not null default 0 check (packs_since_legendary >= 0),
  packs_since_void      integer not null default 0 check (packs_since_void >= 0),
  total_packs_opened    integer not null default 0 check (total_packs_opened >= 0),
  last_legendary_at     timestamptz,
  last_void_at          timestamptz,
  updated_at            timestamptz not null default now()
);

alter table public.player_pity_state enable row level security;

drop policy if exists "Players can read own pity state" on public.player_pity_state;
create policy "Players can read own pity state" on public.player_pity_state
  for select to authenticated using (auth.uid() = user_id);

revoke insert, update, delete on public.player_pity_state from anon, authenticated;
create index if not exists player_pity_state_user_idx on public.player_pity_state (user_id);

-- =========================================================
-- player_daily_rewards
-- =========================================================
create table if not exists public.player_daily_rewards (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  last_claim_at  timestamptz,
  current_streak integer not null default 0,
  best_streak    integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.player_daily_rewards enable row level security;

drop policy if exists "player_daily_rewards_select_own" on public.player_daily_rewards;
create policy "player_daily_rewards_select_own" on public.player_daily_rewards
  for select using (auth.uid() = user_id);

drop policy if exists "player_daily_rewards_insert_own" on public.player_daily_rewards;
create policy "player_daily_rewards_insert_own" on public.player_daily_rewards
  for insert with check (auth.uid() = user_id);

drop policy if exists "player_daily_rewards_update_own" on public.player_daily_rewards;
create policy "player_daily_rewards_update_own" on public.player_daily_rewards
  for update using (auth.uid() = user_id);

create index if not exists player_daily_rewards_last_claim_at_idx on public.player_daily_rewards(last_claim_at desc);

-- =========================================================
-- booster_codes + redemptions
-- =========================================================
create table if not exists public.booster_codes (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique,
  booster_type         text not null default 'void'
    check (booster_type in ('void', 'harmony', 'pacific-bluffs', 'neon-divide', 'ash-district')),
  status               text not null default 'active'
    check (status in ('active', 'disabled')),
  max_redemptions      integer not null default 1 check (max_redemptions > 0),
  redeemed_count       integer not null default 0 check (redeemed_count >= 0),
  expires_at           timestamptz,
  created_by           uuid references auth.users(id) on delete set null,
  twitch_broadcaster_id text,
  created_at           timestamptz not null default now(),
  metadata             jsonb not null default '{}'::jsonb
);

create table if not exists public.booster_code_redemptions (
  id            uuid primary key default gen_random_uuid(),
  code_id       uuid not null references public.booster_codes(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  redeemed_at   timestamptz not null default now(),
  completed_at  timestamptz,
  cards         jsonb not null default '[]'::jsonb,
  metadata      jsonb not null default '{}'::jsonb
);

alter table public.booster_codes enable row level security;
alter table public.booster_code_redemptions enable row level security;

create index if not exists booster_codes_code_idx              on public.booster_codes (code);
create index if not exists booster_codes_status_expires_idx    on public.booster_codes (status, expires_at);
create index if not exists booster_redemptions_code_idx        on public.booster_code_redemptions (code_id);
create index if not exists booster_redemptions_user_idx        on public.booster_code_redemptions (user_id, redeemed_at desc);
create unique index if not exists booster_redemptions_one_per_user_code_idx
  on public.booster_code_redemptions (code_id, user_id);

drop policy if exists "Players can read their own booster redemptions" on public.booster_code_redemptions;
create policy "Players can read their own booster redemptions" on public.booster_code_redemptions
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.booster_codes from anon, authenticated;
revoke all on public.booster_code_redemptions from anon, authenticated;

-- =========================================================
-- booster_credits
-- =========================================================
create table if not exists public.booster_credits (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  booster_type text not null default 'void',
  source       text not null default 'manual',
  source_ref   text,
  claimed      boolean not null default false,
  claimed_at   timestamptz,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id)
);

create index if not exists idx_booster_credits_user on public.booster_credits(user_id) where claimed = false;
create unique index if not exists idx_booster_credits_source_ref on public.booster_credits(source_ref) where source_ref is not null;

alter table public.booster_credits enable row level security;

drop policy if exists "own credits" on public.booster_credits;
create policy "own credits" on public.booster_credits
  for select using (user_id = auth.uid());

drop policy if exists "service all" on public.booster_credits;
create policy "service all" on public.booster_credits
  for all using (auth.role() = 'service_role');

-- =========================================================
-- custom_cards
-- =========================================================
create table if not exists public.custom_cards (
  id          text primary key,
  name        text not null,
  family      text not null default 'global',
  rarity      text not null default 'common',
  "character" text,
  image_url   text,
  description text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists custom_cards_family_idx on public.custom_cards (family);
create index if not exists custom_cards_rarity_idx on public.custom_cards (rarity);

alter table public.custom_cards enable row level security;

drop policy if exists "Public can read custom cards" on public.custom_cards;
create policy "Public can read custom cards" on public.custom_cards
  for select to anon, authenticated using (true);

revoke all on public.custom_cards from anon, authenticated;
grant select on public.custom_cards to anon, authenticated;

-- =========================================================
-- admin_users
-- =========================================================
create table if not exists public.admin_users (
  discord_id text primary key,
  user_id    uuid references auth.users(id) on delete set null,
  label      text,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

-- =========================================================
-- families
-- =========================================================
create table if not exists public.families (
  key        text primary key,
  label      text not null,
  created_at timestamptz not null default now()
);

alter table public.families enable row level security;

drop policy if exists "public read families" on public.families;
create policy "public read families" on public.families
  for select using (true);

-- =========================================================
-- combat : game_sessions, game_actions, matchmaking_queue
-- =========================================================
create table if not exists public.game_sessions (
  id           uuid primary key default gen_random_uuid(),
  player1_id   uuid not null references auth.users(id) on delete cascade,
  player2_id   uuid references auth.users(id) on delete cascade,
  status       text not null default 'waiting'
    check (status in ('waiting', 'active', 'finished', 'abandoned')),
  current_turn uuid,
  turn_number  integer not null default 1,
  state        jsonb not null default '{}',
  winner_id    uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create index if not exists idx_game_sessions_waiting on public.game_sessions(status, created_at) where status = 'waiting';
create index if not exists idx_game_sessions_p1      on public.game_sessions(player1_id, status);
create index if not exists idx_game_sessions_p2      on public.game_sessions(player2_id, status);

create table if not exists public.game_actions (
  id          bigserial primary key,
  session_id  uuid not null references public.game_sessions(id) on delete cascade,
  player_id   uuid not null references auth.users(id),
  action_type text not null,
  payload     jsonb not null default '{}',
  turn_number integer not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_game_actions_session on public.game_actions(session_id, created_at);

create table if not exists public.matchmaking_queue (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  deck      jsonb not null,
  joined_at timestamptz not null default now()
);

alter table public.game_sessions     enable row level security;
alter table public.game_actions      enable row level security;
alter table public.matchmaking_queue enable row level security;

create policy "players see own sessions"   on public.game_sessions for select using (player1_id = auth.uid() or player2_id = auth.uid());
create policy "players update own sessions" on public.game_sessions for update using (player1_id = auth.uid() or player2_id = auth.uid());
create policy "player1 insert session"     on public.game_sessions for insert with check (player1_id = auth.uid());

create policy "players see game actions"   on public.game_actions for select using (
  exists (select 1 from public.game_sessions s where s.id = session_id and (s.player1_id = auth.uid() or s.player2_id = auth.uid()))
);
create policy "players insert game actions" on public.game_actions for insert with check (player_id = auth.uid());

create policy "own queue entry" on public.matchmaking_queue for all using (user_id = auth.uid());

alter publication supabase_realtime add table public.game_sessions;
alter publication supabase_realtime add table public.game_actions;

-- =========================================================
-- ladder : combat_stats, combat_seasons, season_rewards
-- =========================================================
create table if not exists public.combat_stats (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  wins           integer not null default 0,
  losses         integer not null default 0,
  rank_points    integer not null default 0,
  peak_points    integer not null default 0,
  current_streak integer not null default 0,
  best_streak    integer not null default 0,
  season_wins    integer not null default 0,
  season_losses  integer not null default 0,
  updated_at     timestamptz not null default now()
);

create table if not exists public.combat_seasons (
  id         serial primary key,
  name       text not null,
  started_at timestamptz not null default now(),
  ends_at    timestamptz not null,
  is_active  boolean not null default true,
  rewards    jsonb not null default '[]'
);

create table if not exists public.season_rewards (
  id           bigserial primary key,
  season_id    integer not null references public.combat_seasons(id),
  user_id      uuid not null references auth.users(id) on delete cascade,
  rank         text not null,
  rank_points  integer not null,
  booster_type text not null,
  qty          integer not null default 0,
  claimed      boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.combat_stats   enable row level security;
alter table public.combat_seasons enable row level security;
alter table public.season_rewards enable row level security;

create policy "read combat stats"  on public.combat_stats for select using (true);
create policy "own combat stats"   on public.combat_stats for all using (user_id = auth.uid());
create policy "read seasons"       on public.combat_seasons for select using (true);
create policy "own season rewards" on public.season_rewards for select using (user_id = auth.uid());

alter publication supabase_realtime add table public.combat_stats;

insert into public.combat_seasons (name, started_at, ends_at, rewards)
values (
  'Saison 1 — Éveil du VOID', now(), now() + interval '30 days',
  '[
    {"rank":"void",     "min_points":2000,"booster_type":"void",   "qty":3},
    {"rank":"diamond",  "min_points":1500,"booster_type":"void",   "qty":2},
    {"rank":"platinum", "min_points":1000,"booster_type":"harmony","qty":2},
    {"rank":"gold",     "min_points":600, "booster_type":"harmony","qty":1},
    {"rank":"silver",   "min_points":300, "booster_type":"void",   "qty":1},
    {"rank":"bronze",   "min_points":0,   "booster_type":"void",   "qty":0}
  ]'::jsonb
)
on conflict do nothing;

-- =========================================================
-- social : friendships, direct_messages, game_challenges
-- =========================================================
create table if not exists public.friendships (
  id          bigserial primary key,
  sender_id   uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(sender_id, receiver_id)
);

create index if not exists idx_friendships_receiver on public.friendships(receiver_id, status);
create index if not exists idx_friendships_sender   on public.friendships(sender_id,   status);

create table if not exists public.direct_messages (
  id          bigserial primary key,
  sender_id   uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  content     text not null check (char_length(content) <= 500),
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_dm_conversation on public.direct_messages(
  least(sender_id::text, receiver_id::text),
  greatest(sender_id::text, receiver_id::text),
  created_at
);

create table if not exists public.game_challenges (
  id            uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users(id) on delete cascade,
  challenged_id uuid not null references auth.users(id) on delete cascade,
  deck          jsonb not null,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  session_id    uuid references public.game_sessions(id),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '2 minutes'
);

create index if not exists idx_challenges_challenged on public.game_challenges(challenged_id, status);

alter table public.friendships     enable row level security;
alter table public.direct_messages enable row level security;
alter table public.game_challenges enable row level security;

create policy "see own friendships"    on public.friendships for select using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy "send friend request"    on public.friendships for insert with check (sender_id = auth.uid());
create policy "update own friendships" on public.friendships for update using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy "delete own friendships" on public.friendships for delete using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "see own messages" on public.direct_messages for select using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy "send message"     on public.direct_messages for insert with check (sender_id = auth.uid());
create policy "mark read"        on public.direct_messages for update using (receiver_id = auth.uid());

create policy "see own challenges" on public.game_challenges for select using (challenger_id = auth.uid() or challenged_id = auth.uid());
create policy "send challenge"     on public.game_challenges for insert with check (challenger_id = auth.uid());
create policy "update challenge"   on public.game_challenges for update using (challenger_id = auth.uid() or challenged_id = auth.uid());

alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.direct_messages;
alter publication supabase_realtime add table public.game_challenges;

-- =========================================================
-- trade_offers
-- =========================================================
create table if not exists public.trade_offers (
  id                uuid primary key default gen_random_uuid(),
  sender_id         uuid not null references auth.users(id) on delete cascade,
  receiver_id       uuid not null references auth.users(id) on delete cascade,
  offered_card_id   uuid not null references public.player_cards(id) on delete cascade,
  offered_card_key  text not null,
  offered_rarity    text not null,
  wanted_card_key   text not null,
  wanted_rarity     text,
  wanted_card_name  text,
  status            text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  message           text,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default now() + interval '48 hours',
  responded_at      timestamptz
);

create index if not exists idx_trade_receiver on public.trade_offers(receiver_id, status);
create index if not exists idx_trade_sender   on public.trade_offers(sender_id,   status);

alter table public.trade_offers enable row level security;

create policy "see own trades"    on public.trade_offers for select using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy "send trade"        on public.trade_offers for insert with check (sender_id = auth.uid());
create policy "update own trades" on public.trade_offers for update using (sender_id = auth.uid() or receiver_id = auth.uid());

alter publication supabase_realtime add table public.trade_offers;

-- =========================================================
-- Twitch : streamers, rewards, eventsub_log, rare_pull_log, pending_codes
-- =========================================================
create table if not exists public.twitch_streamers (
  id                serial primary key,
  broadcaster_id    text not null unique,
  broadcaster_login text not null,
  broadcaster_name  text,
  bot_access_token  text,
  bot_refresh_token text,
  eventsub_secret   text not null,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

create table if not exists public.twitch_rewards (
  id             serial primary key,
  broadcaster_id text not null references public.twitch_streamers(broadcaster_id) on delete cascade,
  reward_id      text not null unique,
  booster_type   text not null,
  reward_label   text,
  points_cost    int,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create index if not exists idx_twitch_rewards_reward_id    on public.twitch_rewards(reward_id);
create index if not exists idx_twitch_rewards_broadcaster  on public.twitch_rewards(broadcaster_id);

create table if not exists public.twitch_eventsub_log (
  id               bigserial primary key,
  broadcaster_id   text,
  broadcaster_login text,
  twitch_user_id   text,
  twitch_login     text,
  reward_id        text,
  redemption_id    text unique,
  status           text not null default 'pending',
  code_generated   text,
  error_message    text,
  created_at       timestamptz not null default now()
);

create table if not exists public.twitch_rare_pull_log (
  id                bigserial primary key,
  user_id           uuid references auth.users(id),
  twitch_login      text,
  broadcaster_id    text,
  broadcaster_login text,
  card_name         text,
  rarity            text,
  announced_at      timestamptz not null default now()
);

create table if not exists public.twitch_pending_codes (
  id                bigserial primary key,
  twitch_user_id    text not null,
  user_id           uuid references auth.users(id),
  code              text not null,
  booster_type      text not null default 'void',
  broadcaster_login text,
  broadcaster_id    text,
  claimed           boolean not null default false,
  claimed_at        timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_pending_codes_user_id   on public.twitch_pending_codes(user_id)        where claimed = false;
create index if not exists idx_pending_codes_twitch_id on public.twitch_pending_codes(twitch_user_id) where claimed = false;

alter table public.twitch_streamers     enable row level security;
alter table public.twitch_rewards       enable row level security;
alter table public.twitch_eventsub_log  enable row level security;
alter table public.twitch_rare_pull_log enable row level security;
alter table public.twitch_pending_codes enable row level security;

create policy "service only" on public.twitch_streamers     using (auth.role() = 'service_role');
create policy "service only" on public.twitch_rewards       using (auth.role() = 'service_role');
create policy "service only" on public.twitch_eventsub_log  using (auth.role() = 'service_role');
create policy "service only" on public.twitch_rare_pull_log using (auth.role() = 'service_role');

create policy "own codes only"  on public.twitch_pending_codes for select using (user_id = auth.uid());
create policy "service write"   on public.twitch_pending_codes for all using (auth.role() = 'service_role');

-- =========================================================
-- FONCTIONS
-- =========================================================

-- ── Helpers admin ──────────────────────────────────────────────────────────────
create or replace function public.make_booster_code(input_prefix text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  safe_prefix text;
  body_a text;
  body_b text;
begin
  safe_prefix := upper(regexp_replace(coalesce(input_prefix, 'VOID'), '[^A-Za-z0-9]+', '', 'g'));
  if safe_prefix = '' then safe_prefix := 'VOID'; end if;
  body_a := upper(substr(md5(random()::text || clock_timestamp()::text || txid_current()::text), 1, 4));
  body_b := upper(substr(md5(random()::text || clock_timestamp()::text || txid_current()::text), 1, 4));
  return safe_prefix || '-' || body_a || '-' || body_b;
end;
$$;

create or replace function public.current_discord_id()
returns text language plpgsql stable security definer set search_path = public, auth as $$
declare
  metadata          jsonb := '{}'::jsonb;
  identity_metadata jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then return null; end if;
  select coalesce(raw_user_meta_data, '{}'::jsonb) into metadata from auth.users where id = auth.uid();
  select coalesce(identity_data, '{}'::jsonb) into identity_metadata
  from auth.identities where user_id = auth.uid() and provider = 'discord' order by created_at desc limit 1;
  return nullif(trim(coalesce(
    metadata ->> 'provider_id', metadata ->> 'discord_id', metadata ->> 'user_id', metadata ->> 'sub',
    identity_metadata ->> 'provider_id', identity_metadata ->> 'discord_id',
    identity_metadata ->> 'user_id', identity_metadata ->> 'sub',
    auth.jwt() -> 'user_metadata' ->> 'provider_id', auth.jwt() -> 'user_metadata' ->> 'discord_id',
    auth.jwt() -> 'user_metadata' ->> 'user_id', auth.jwt() -> 'user_metadata' ->> 'sub', ''
  )), '');
end;
$$;

create or replace function public.admin_is_current_user()
returns boolean language plpgsql stable security definer set search_path = public as $$
declare did text;
begin
  if auth.uid() is null then return false; end if;
  did := public.current_discord_id();
  if did is null or did = '' then return false; end if;
  return exists (select 1 from public.admin_users where trim(discord_id) = trim(did));
end;
$$;

create or replace function public.admin_is_discord_admin(input_discord_id text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare did text; client_did text;
begin
  if auth.uid() is null then return false; end if;
  did := public.current_discord_id();
  client_did := nullif(trim(coalesce(input_discord_id, '')), '');
  return exists (
    select 1 from public.admin_users
    where trim(discord_id) = trim(coalesce(did, ''))
       or (client_did is not null and trim(discord_id) = client_did)
  );
end;
$$;

create or replace function public.assert_discord_id_is_admin(input_discord_id text default null)
returns void language plpgsql stable security definer set search_path = public as $$
declare did text; client_did text;
begin
  if auth.uid() is null then raise exception 'Connexion Discord requise.'; end if;
  did := public.current_discord_id();
  client_did := nullif(trim(coalesce(input_discord_id, '')), '');
  if exists (
    select 1 from public.admin_users
    where trim(discord_id) = trim(coalesce(did, ''))
       or (client_did is not null and trim(discord_id) = client_did)
  ) then return; end if;
  raise exception 'Accès admin refusé. Discord ID serveur : %, Discord ID client : %',
    coalesce(did, 'inconnu'), coalesce(client_did, 'inconnu');
end;
$$;

create or replace function public.assert_current_user_is_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin perform public.assert_discord_id_is_admin(null); end;
$$;

create or replace function public.admin_current_identity_debug()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare metadata jsonb := '{}'::jsonb; identity_metadata jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('authenticated', false); end if;
  select coalesce(raw_user_meta_data, '{}'::jsonb) into metadata from auth.users where id = auth.uid();
  select coalesce(identity_data, '{}'::jsonb) into identity_metadata
  from auth.identities where user_id = auth.uid() and provider = 'discord' order by created_at desc limit 1;
  return jsonb_build_object(
    'authenticated', true, 'user_id', auth.uid(),
    'discord_id', public.current_discord_id(), 'is_admin', public.admin_is_current_user(),
    'user_metadata', metadata, 'identity_data', identity_metadata
  );
end;
$$;

-- ── exec_sql (SQL editor admin) ─────────────────────────────────────────────
create or replace function public.exec_sql(query text)
returns json language plpgsql security definer set search_path = public as $$
declare result json;
begin
  begin
    execute 'select json_agg(t) from (' || query || ') t' into result;
    return coalesce(result, '[]'::json);
  exception when others then
    begin
      execute query;
      return '{"status":"ok"}'::json;
    exception when others then
      return json_build_object('error', sqlerrm);
    end;
  end;
end;
$$;

grant execute on function public.exec_sql(text) to service_role, authenticated;

-- ── Pity ──────────────────────────────────────────────────────────────────────
create or replace function public.get_or_create_pity_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_state public.player_pity_state%rowtype;
begin
  if v_user_id is null then raise exception 'Authentification requise.'; end if;
  insert into public.player_pity_state (user_id) values (v_user_id) on conflict (user_id) do nothing;
  select * into v_state from public.player_pity_state where user_id = v_user_id;
  return jsonb_build_object(
    'packsSinceLegendary', v_state.packs_since_legendary,
    'packsSinceVoid',      v_state.packs_since_void,
    'totalPacksOpened',    v_state.total_packs_opened,
    'lastLegendaryAt',     v_state.last_legendary_at,
    'lastVoidAt',          v_state.last_void_at
  );
end;
$$;

create or replace function public.update_pity_after_pack(input_cards jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id             uuid := auth.uid();
  v_has_legendary       boolean;
  v_has_void            boolean;
  v_state               public.player_pity_state%rowtype;
  v_new_since_legendary integer;
  v_new_since_void      integer;
begin
  if v_user_id is null then raise exception 'Authentification requise.'; end if;
  v_has_void := exists (select 1 from jsonb_array_elements(input_cards) as c where c->>'rarity' = 'void');
  v_has_legendary := v_has_void or exists (select 1 from jsonb_array_elements(input_cards) as c where c->>'rarity' = 'legendary');
  insert into public.player_pity_state (user_id) values (v_user_id) on conflict (user_id) do nothing;
  select * into v_state from public.player_pity_state where user_id = v_user_id;
  v_new_since_legendary := case when v_has_legendary then 0 else v_state.packs_since_legendary + 1 end;
  v_new_since_void      := case when v_has_void then 0 else v_state.packs_since_void + 1 end;
  update public.player_pity_state set
    packs_since_legendary = v_new_since_legendary,
    packs_since_void      = v_new_since_void,
    total_packs_opened    = v_state.total_packs_opened + 1,
    last_legendary_at     = case when v_has_legendary then now() else v_state.last_legendary_at end,
    last_void_at          = case when v_has_void then now() else v_state.last_void_at end,
    updated_at            = now()
  where user_id = v_user_id;
  return jsonb_build_object(
    'packsSinceLegendary', v_new_since_legendary,
    'packsSinceVoid',      v_new_since_void,
    'totalPacksOpened',    v_state.total_packs_opened + 1,
    'pulledLegendary',     v_has_legendary,
    'pulledVoid',          v_has_void
  );
end;
$$;

-- ── Daily reward ──────────────────────────────────────────────────────────────
create or replace function public.claim_daily_reward()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id       uuid := auth.uid();
  v_daily         public.player_daily_rewards%rowtype;
  v_now           timestamptz := now();
  v_hours_since   numeric;
  v_streak_reset  boolean;
  v_new_streak    integer;
  v_best_streak   integer;
  v_bonus_packs   integer;
  v_total_packs   integer;
  v_code          text;
  v_inserted_code public.booster_codes%rowtype;
  v_attempts      integer := 0;
begin
  if v_user_id is null then return jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); end if;
  insert into public.player_daily_rewards (user_id, last_claim_at, current_streak, best_streak)
  values (v_user_id, null, 0, 0) on conflict (user_id) do nothing;
  select * into v_daily from public.player_daily_rewards where user_id = v_user_id for update;
  if v_daily.last_claim_at is not null then
    v_hours_since := extract(epoch from (v_now - v_daily.last_claim_at)) / 3600;
    if v_hours_since < 20 then
      return jsonb_build_object('ok', false, 'error_code', 'ALREADY_CLAIMED', 'hours_remaining', ceil(20 - v_hours_since)::integer);
    end if;
    v_streak_reset := v_hours_since > 48;
  else
    v_streak_reset := false;
  end if;
  v_new_streak  := case when v_streak_reset then 1 else v_daily.current_streak + 1 end;
  v_best_streak := greatest(v_daily.best_streak, v_new_streak);
  v_bonus_packs := case when v_new_streak % 7 = 0 then 1 else 0 end;
  v_total_packs := 1 + v_bonus_packs;
  update public.player_daily_rewards set
    last_claim_at = v_now, current_streak = v_new_streak,
    best_streak = v_best_streak, updated_at = v_now
  where user_id = v_user_id;
  loop
    v_code := public.make_booster_code('DAILY');
    begin
      insert into public.booster_codes (code, booster_type, status, max_redemptions, redeemed_count, expires_at, created_by, metadata)
      values (v_code, 'void', 'active', v_total_packs, 0, v_now + interval '48 hours', v_user_id,
        jsonb_build_object('created_via', 'daily_reward', 'streak', v_new_streak, 'bonus_packs', v_bonus_packs))
      returning * into v_inserted_code;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts >= 5 then return jsonb_build_object('ok', false, 'error_code', 'CODE_GENERATION_FAILED'); end if;
    end;
  end loop;
  return jsonb_build_object(
    'ok', true, 'current_streak', v_new_streak, 'best_streak', v_best_streak,
    'bonus_packs', v_bonus_packs, 'total_packs', v_total_packs,
    'booster_code', v_code, 'booster_type', 'void', 'streak_reset', v_streak_reset
  );
end;
$$;

-- ── Booster codes ─────────────────────────────────────────────────────────────
create or replace function public.redeem_booster_code(input_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  normalized_code text;
  selected_code   public.booster_codes%rowtype;
  redemption      public.booster_code_redemptions%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion Discord requise.'; end if;
  normalized_code := upper(regexp_replace(coalesce(input_code, ''), '\s+', '', 'g'));
  normalized_code := replace(replace(normalized_code, '–', '-'), '—', '-');
  if normalized_code = '' then raise exception 'Code booster manquant.'; end if;
  select * into selected_code from public.booster_codes where code = normalized_code for update;
  if not found then raise exception 'Code booster invalide.'; end if;
  if selected_code.status <> 'active' then raise exception 'Ce code booster est désactivé.'; end if;
  if selected_code.expires_at is not null and selected_code.expires_at <= now() then raise exception 'Ce code booster a expiré.'; end if;
  if selected_code.redeemed_count >= selected_code.max_redemptions then raise exception 'Ce code booster a déjà été utilisé.'; end if;
  if exists (select 1 from public.booster_code_redemptions where code_id = selected_code.id and user_id = auth.uid() and status in ('pending', 'completed')) then
    raise exception 'Tu as déjà utilisé ce code booster.';
  end if;
  insert into public.booster_code_redemptions (code_id, user_id, status, metadata)
  values (selected_code.id, auth.uid(), 'pending', jsonb_build_object('source', 'web', 'reserved_at', now()))
  returning * into redemption;
  update public.booster_codes set redeemed_count = redeemed_count + 1 where id = selected_code.id;
  return jsonb_build_object(
    'redemption_id', redemption.id, 'code_id', selected_code.id,
    'code', selected_code.code, 'booster_type', selected_code.booster_type,
    'remaining_uses', greatest(0, selected_code.max_redemptions - selected_code.redeemed_count - 1)
  );
end;
$$;

create or replace function public.complete_booster_redemption(input_redemption_id uuid, input_cards jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cards_count integer;
begin
  if auth.uid() is null then raise exception 'Connexion Discord requise.'; end if;
  if input_redemption_id is null then raise exception 'Redemption manquante.'; end if;
  if not exists (select 1 from public.booster_code_redemptions where id = input_redemption_id and user_id = auth.uid() and status = 'pending') then
    raise exception 'Redemption invalide ou déjà complétée.';
  end if;
  if jsonb_typeof(input_cards) <> 'array' then raise exception 'Cartes invalides.'; end if;
  select jsonb_array_length(input_cards) into cards_count;
  if cards_count <= 0 then raise exception 'Aucune carte à ajouter.'; end if;
  insert into public.player_cards (user_id, card_id, rarity, family, metadata)
  select
    auth.uid(),
    coalesce(nullif(card.card_id, ''), nullif(card.id, ''), nullif(card.name, ''), 'unknown'),
    case when lower(coalesce(nullif(card.rarity, ''), 'common')) = 'uncommon' then 'common'
         else lower(coalesce(nullif(card.rarity, ''), 'common')) end,
    coalesce(nullif(card.family, ''), 'global'),
    jsonb_build_object('name', card.name, 'source', coalesce(card.source, 'booster'), 'redemption_id', input_redemption_id, 'rolled_at', now())
  from jsonb_to_recordset(input_cards) as card(card_id text, id text, rarity text, family text, name text, source text)
  where coalesce(nullif(card.card_id, ''), nullif(card.id, ''), nullif(card.name, '')) is not null
    and lower(coalesce(nullif(card.rarity, ''), 'common')) in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'void');
  update public.booster_code_redemptions
  set status = 'completed', completed_at = now(), cards = input_cards,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('completed_via', 'complete_booster_redemption')
  where id = input_redemption_id;
  return jsonb_build_object('status', 'completed', 'redemption_id', input_redemption_id, 'cards_added', cards_count);
end;
$$;

-- ── Admin booster codes ──────────────────────────────────────────────────────
create or replace function public.admin_generate_booster_codes_client(
  input_prefix text default 'VOID', input_count integer default 10,
  input_booster_type text default 'void', input_expires_at timestamptz default null,
  input_max_redemptions integer default 1, input_admin_discord_id text default null
)
returns table(id uuid, code text, booster_type text, status text, max_redemptions integer, redeemed_count integer, expires_at timestamptz, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  generated_code text;
  inserted       public.booster_codes%rowtype;
  inserted_count integer := 0;
begin
  perform public.assert_discord_id_is_admin(input_admin_discord_id);
  if input_count < 1 or input_count > 100 then raise exception 'input_count doit être entre 1 et 100.'; end if;
  if input_max_redemptions < 1 or input_max_redemptions > 999 then raise exception 'input_max_redemptions doit être entre 1 et 999.'; end if;
  if input_booster_type not in ('void', 'harmony', 'pacific-bluffs', 'neon-divide', 'ash-district') then raise exception 'Type de booster invalide.'; end if;
  while inserted_count < input_count loop
    generated_code := public.make_booster_code(input_prefix);
    begin
      insert into public.booster_codes (code, booster_type, expires_at, max_redemptions, redeemed_count, status, created_by, metadata)
      values (generated_code, input_booster_type, input_expires_at, input_max_redemptions, 0, 'active', auth.uid(), jsonb_build_object('created_via', 'void_pack_admin_panel'))
      returning * into inserted;
      id := inserted.id; code := inserted.code; booster_type := inserted.booster_type;
      status := inserted.status; max_redemptions := inserted.max_redemptions;
      redeemed_count := inserted.redeemed_count; expires_at := inserted.expires_at;
      created_at := inserted.created_at;
      inserted_count := inserted_count + 1;
      return next;
    exception when unique_violation then end;
  end loop;
end;
$$;

create or replace function public.admin_list_booster_codes(input_limit integer default 100, input_admin_discord_id text default null)
returns table(id uuid, code text, booster_type text, status text, max_redemptions integer, redeemed_count integer, expires_at timestamptz, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_discord_id_is_admin(input_admin_discord_id);
  return query select c.id, c.code, c.booster_type, c.status, c.max_redemptions, c.redeemed_count, c.expires_at, c.created_at
  from public.booster_codes c order by c.created_at desc limit greatest(1, least(coalesce(input_limit, 100), 500));
end;
$$;

create or replace function public.admin_list_booster_redemptions(input_limit integer default 100)
returns table(id uuid, code text, booster_type text, user_id uuid, status text, redeemed_at timestamptz, completed_at timestamptz, cards jsonb)
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_current_user_is_admin();
  return query select r.id, c.code, c.booster_type, r.user_id, r.status, r.redeemed_at, r.completed_at, r.cards
  from public.booster_code_redemptions r join public.booster_codes c on c.id = r.code_id
  order by r.redeemed_at desc limit greatest(1, least(coalesce(input_limit, 100), 500));
end;
$$;

-- ── Custom cards ──────────────────────────────────────────────────────────────
create or replace function public.list_custom_cards()
returns table(id text, name text, family text, rarity text, "character" text, image_url text, metadata jsonb, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.family, c.rarity, c."character", c.image_url, c.metadata, c.created_at, c.updated_at
  from public.custom_cards c order by c.family asc, c.rarity asc, c.name asc;
$$;

create or replace function public.admin_save_custom_card_client(input_payload jsonb)
returns public.custom_cards language plpgsql volatile security definer set search_path = public as $$
declare
  clean_id         text := lower(regexp_replace(trim(coalesce(input_payload->>'card_id', '')), '[^a-zA-Z0-9_-]+', '-', 'g'));
  saved            public.custom_cards;
  admin_discord_id text := nullif(trim(coalesce(input_payload->>'admin_discord_id', '')), '');
  card_name        text := trim(coalesce(input_payload->>'name', ''));
  card_family      text := lower(trim(coalesce(input_payload->>'family', 'global')));
  card_rarity      text := lower(trim(coalesce(input_payload->>'rarity', 'common')));
  card_character   text := nullif(trim(coalesce(input_payload->>'character', '')), '');
  card_image_url   text := nullif(trim(coalesce(input_payload->>'image_url', '')), '');
  card_metadata    jsonb := coalesce(input_payload->'metadata', '{}'::jsonb);
begin
  perform public.assert_discord_id_is_admin(admin_discord_id);
  if clean_id is null or clean_id = '' then raise exception 'ID carte requis.'; end if;
  if card_name = '' then raise exception 'Nom carte requis.'; end if;
  if card_rarity not in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'void') then raise exception 'Rareté invalide.'; end if;
  insert into public.custom_cards (id, name, family, rarity, "character", image_url, metadata, updated_at)
  values (clean_id, card_name, card_family, card_rarity, card_character, card_image_url, card_metadata, now())
  on conflict (id) do update set
    name = excluded.name, family = excluded.family, rarity = excluded.rarity,
    "character" = excluded."character", image_url = excluded.image_url,
    metadata = excluded.metadata, updated_at = now()
  returning * into saved;
  return saved;
end;
$$;

create or replace function public.admin_delete_custom_card_client(input_card_id text, input_admin_discord_id text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.assert_discord_id_is_admin(input_admin_discord_id);
  delete from public.custom_cards where id = input_card_id;
  return jsonb_build_object('deleted', input_card_id);
end;
$$;

-- ── Admin players ─────────────────────────────────────────────────────────────
create or replace function public.admin_list_players(input_admin_discord_id text default null, input_limit integer default 200)
returns table(user_id uuid, username text, avatar_url text, level integer, xp integer, packs_opened integer, void_pulls integer, highest_rarity text, current_streak integer, best_streak integer, card_count bigint, last_active timestamptz, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_discord_id_is_admin(input_admin_discord_id);
  return query select
    p.user_id, p.username, p.avatar_url, p.level, p.xp, p.packs_opened, p.void_pulls,
    p.highest_rarity, p.current_streak, p.best_streak,
    count(pc.id) as card_count, max(pc.obtained_at) as last_active, p.created_at
  from public.player_profiles p
  left join public.player_cards pc on pc.user_id = p.user_id
  group by p.user_id, p.username, p.avatar_url, p.level, p.xp, p.packs_opened, p.void_pulls,
           p.highest_rarity, p.current_streak, p.best_streak, p.created_at
  order by last_active desc nulls last limit input_limit;
end;
$$;

create or replace function public.admin_get_player_detail(input_user_id uuid, input_admin_discord_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_profile public.player_profiles%rowtype;
  v_cards   jsonb;
  v_pity    jsonb;
  v_daily   jsonb;
begin
  perform public.assert_discord_id_is_admin(input_admin_discord_id);
  select * into v_profile from public.player_profiles where user_id = input_user_id;
  select jsonb_agg(jsonb_build_object(
    'id', pc.id, 'card_id', pc.card_id, 'rarity', pc.rarity, 'family', pc.family,
    'obtained_at', pc.obtained_at, 'name', pc.metadata->>'name', 'image', pc.metadata->>'image',
    'source', pc.metadata->>'source', 'redemption_id', pc.metadata->>'redemption_id'
  ) order by case pc.rarity when 'void' then 5 when 'legendary' then 4 when 'epic' then 3 when 'rare' then 2 else 1 end desc, pc.obtained_at desc)
  into v_cards from public.player_cards pc where pc.user_id = input_user_id;
  select jsonb_build_object('packs_since_legendary', pps.packs_since_legendary, 'packs_since_void', pps.packs_since_void, 'total_packs_opened', pps.total_packs_opened, 'last_legendary_at', pps.last_legendary_at, 'last_void_at', pps.last_void_at)
  into v_pity from public.player_pity_state pps where pps.user_id = input_user_id;
  select jsonb_build_object('current_streak', pdr.current_streak, 'best_streak', pdr.best_streak, 'last_claim_at', pdr.last_claim_at)
  into v_daily from public.player_daily_rewards pdr where pdr.user_id = input_user_id;
  return jsonb_build_object(
    'user_id', input_user_id, 'username', v_profile.username, 'avatar_url', v_profile.avatar_url,
    'level', v_profile.level, 'xp', v_profile.xp, 'packs_opened', v_profile.packs_opened,
    'void_pulls', v_profile.void_pulls, 'highest_rarity', v_profile.highest_rarity,
    'created_at', v_profile.created_at, 'cards', coalesce(v_cards, '[]'::jsonb),
    'pity', coalesce(v_pity, '{}'::jsonb), 'daily', coalesce(v_daily, '{}'::jsonb)
  );
end;
$$;

-- ── Ladder ───────────────────────────────────────────────────────────────────
create or replace function public.get_rank_from_points(p_points integer)
returns text language sql immutable as $$
  select case when p_points >= 2000 then 'void' when p_points >= 1500 then 'diamond'
    when p_points >= 1000 then 'platinum' when p_points >= 600 then 'gold'
    when p_points >= 300 then 'silver' else 'bronze' end;
$$;

create or replace function public.get_combat_ladder(p_limit int default 50)
returns table(rank bigint, user_id uuid, username text, avatar_url text, level integer, rank_points integer, rank_name text, wins integer, losses integer, win_rate numeric, best_streak integer, season_wins integer)
language sql security definer as $$
  select row_number() over (order by cs.rank_points desc, cs.wins desc) as rank,
    pp.user_id, pp.username, pp.avatar_url, pp.level,
    cs.rank_points, public.get_rank_from_points(cs.rank_points) as rank_name,
    cs.wins, cs.losses,
    case when cs.wins + cs.losses > 0 then round(cs.wins::numeric / (cs.wins + cs.losses) * 100, 1) else 0 end as win_rate,
    cs.best_streak, cs.season_wins
  from public.combat_stats cs join public.player_profiles pp on pp.user_id = cs.user_id
  where cs.wins + cs.losses > 0 order by cs.rank_points desc, cs.wins desc limit p_limit;
$$;

create or replace function public.record_combat_result(p_session_id uuid, p_winner_id uuid)
returns void language plpgsql security definer as $$
declare v_session public.game_sessions; v_loser_id uuid;
begin
  select * into v_session from public.game_sessions where id = p_session_id;
  if not found then return; end if;
  v_loser_id := case when v_session.player1_id = p_winner_id then v_session.player2_id else v_session.player1_id end;
  insert into public.combat_stats (user_id, wins, rank_points, peak_points, current_streak, best_streak, season_wins)
  values (p_winner_id, 1, 25, 25, 1, 1, 1) on conflict (user_id) do update set
    wins = combat_stats.wins + 1, rank_points = greatest(0, combat_stats.rank_points + 25),
    peak_points = greatest(combat_stats.peak_points, combat_stats.rank_points + 25),
    current_streak = greatest(0, combat_stats.current_streak) + 1,
    best_streak = greatest(combat_stats.best_streak, greatest(0, combat_stats.current_streak) + 1),
    season_wins = combat_stats.season_wins + 1, updated_at = now();
  insert into public.combat_stats (user_id, losses, rank_points, current_streak, season_losses)
  values (v_loser_id, 1, 0, -1, 1) on conflict (user_id) do update set
    losses = combat_stats.losses + 1, rank_points = greatest(0, combat_stats.rank_points - 15),
    current_streak = least(0, combat_stats.current_streak) - 1,
    season_losses = combat_stats.season_losses + 1, updated_at = now();
end;
$$;

-- ── Combat RPC ────────────────────────────────────────────────────────────────
create or replace function public.join_matchmaking(p_deck jsonb)
returns jsonb language plpgsql security definer as $$
declare v_opp_id uuid; v_opp_deck jsonb; v_sess_id uuid;
begin
  select user_id, deck into v_opp_id, v_opp_deck from public.matchmaking_queue
  where user_id != auth.uid() order by joined_at asc limit 1;
  if found then
    delete from public.matchmaking_queue where user_id = v_opp_id;
    insert into public.game_sessions (player1_id, player2_id, status, current_turn, state)
    values (v_opp_id, auth.uid(), 'active', v_opp_id, jsonb_build_object(
      'p1_hp', 30, 'p2_hp', 30, 'p1_mana', 1, 'p1_max_mana', 1, 'p2_mana', 0, 'p2_max_mana', 0,
      'p1_board', '[]'::jsonb, 'p2_board', '[]'::jsonb, 'p1_deck', v_opp_deck, 'p2_deck', p_deck, 'turn', 1))
    returning id into v_sess_id;
    return jsonb_build_object('status', 'matched', 'session_id', v_sess_id, 'opponent_id', v_opp_id, 'you_are', 'player2');
  else
    insert into public.matchmaking_queue (user_id, deck) values (auth.uid(), p_deck)
    on conflict (user_id) do update set deck = p_deck, joined_at = now();
    return jsonb_build_object('status', 'waiting');
  end if;
end;
$$;

create or replace function public.leave_matchmaking()
returns void language sql security definer as $$
  delete from public.matchmaking_queue where user_id = auth.uid();
$$;

create or replace function public.submit_game_action(p_session_id uuid, p_action_type text, p_payload jsonb, p_new_state jsonb default null)
returns jsonb language plpgsql security definer as $$
declare v_session public.game_sessions; v_is_p1 boolean; v_opp_id uuid;
begin
  select * into v_session from public.game_sessions
  where id = p_session_id and status = 'active' and current_turn = auth.uid();
  if not found then return jsonb_build_object('error', 'not_your_turn'); end if;
  v_is_p1 := v_session.player1_id = auth.uid();
  v_opp_id := case when v_is_p1 then v_session.player2_id else v_session.player1_id end;
  insert into public.game_actions (session_id, player_id, action_type, payload, turn_number)
  values (p_session_id, auth.uid(), p_action_type, p_payload, v_session.turn_number);
  if p_action_type = 'end_turn' then
    update public.game_sessions set current_turn = v_opp_id, turn_number = turn_number + 1,
      state = coalesce(p_new_state, state), updated_at = now() where id = p_session_id;
  elsif p_action_type = 'surrender' then
    update public.game_sessions set status = 'finished', winner_id = v_opp_id,
      finished_at = now(), updated_at = now() where id = p_session_id;
  else
    update public.game_sessions set state = coalesce(p_new_state, state), updated_at = now() where id = p_session_id;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.finish_game(p_session_id uuid, p_winner_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.game_sessions set status = 'finished', winner_id = p_winner_id, finished_at = now(), updated_at = now()
  where id = p_session_id and (player1_id = auth.uid() or player2_id = auth.uid());
end;
$$;

-- ── Social RPC ────────────────────────────────────────────────────────────────
create or replace function public.get_friends()
returns table(friendship_id bigint, status text, direction text, user_id uuid, username text, avatar_url text, level integer, created_at timestamptz)
language sql security definer as $$
  select f.id, f.status,
    case when f.sender_id = auth.uid() then 'sent' else 'received' end,
    case when f.sender_id = auth.uid() then f.receiver_id else f.sender_id end,
    pp.username, pp.avatar_url, pp.level, f.created_at
  from public.friendships f
  join public.player_profiles pp on pp.user_id = case when f.sender_id = auth.uid() then f.receiver_id else f.sender_id end
  where f.sender_id = auth.uid() or f.receiver_id = auth.uid()
  order by f.status = 'accepted' desc, f.created_at desc;
$$;

create or replace function public.search_player(p_query text)
returns table(user_id uuid, username text, avatar_url text, level integer)
language sql security definer as $$
  select user_id, username, avatar_url, level from public.player_profiles
  where username ilike '%' || p_query || '%' and user_id != auth.uid() limit 10;
$$;

create or replace function public.get_conversation(p_other_id uuid, p_limit int default 50)
returns table(id bigint, sender_id uuid, content text, read_at timestamptz, created_at timestamptz)
language sql security definer as $$
  select id, sender_id, content, read_at, created_at from public.direct_messages
  where (sender_id = auth.uid() and receiver_id = p_other_id)
     or (sender_id = p_other_id and receiver_id = auth.uid())
  order by created_at desc limit p_limit;
$$;

create or replace function public.mark_messages_read(p_sender_id uuid)
returns void language sql security definer as $$
  update public.direct_messages set read_at = now()
  where sender_id = p_sender_id and receiver_id = auth.uid() and read_at is null;
$$;

create or replace function public.accept_challenge(p_challenge_id uuid, p_deck jsonb)
returns jsonb language plpgsql security definer as $$
declare v_challenge public.game_challenges; v_sess_id uuid;
begin
  select * into v_challenge from public.game_challenges
  where id = p_challenge_id and challenged_id = auth.uid() and status = 'pending' and expires_at > now();
  if not found then return jsonb_build_object('error', 'challenge_not_found_or_expired'); end if;
  insert into public.game_sessions (player1_id, player2_id, status, current_turn, state)
  values (v_challenge.challenger_id, auth.uid(), 'active', v_challenge.challenger_id, jsonb_build_object(
    'p1_hp', 30, 'p2_hp', 30, 'p1_mana', 1, 'p1_max_mana', 1, 'p2_mana', 0, 'p2_max_mana', 0,
    'p1_board', '[]'::jsonb, 'p2_board', '[]'::jsonb, 'p1_deck', v_challenge.deck, 'p2_deck', p_deck, 'turn', 1))
  returning id into v_sess_id;
  update public.game_challenges set status = 'accepted', session_id = v_sess_id where id = p_challenge_id;
  return jsonb_build_object('status', 'accepted', 'session_id', v_sess_id, 'you_are', 'player2');
end;
$$;

-- ── Trade RPC ─────────────────────────────────────────────────────────────────
create or replace function public.accept_trade(p_trade_id uuid)
returns jsonb language plpgsql security definer as $$
declare v_trade public.trade_offers; v_wanted_id uuid;
begin
  select * into v_trade from public.trade_offers
  where id = p_trade_id and receiver_id = auth.uid() and status = 'pending' and expires_at > now();
  if not found then return jsonb_build_object('error', 'trade_not_found_or_expired'); end if;
  select id into v_wanted_id from public.player_cards where user_id = auth.uid() and card_id = v_trade.wanted_card_key limit 1;
  if not found then return jsonb_build_object('error', 'wanted_card_not_in_collection'); end if;
  if not exists (select 1 from public.player_cards where id = v_trade.offered_card_id and user_id = v_trade.sender_id) then
    return jsonb_build_object('error', 'offered_card_no_longer_available');
  end if;
  update public.player_cards set user_id = auth.uid() where id = v_trade.offered_card_id;
  update public.player_cards set user_id = v_trade.sender_id where id = v_wanted_id;
  update public.trade_offers set status = 'accepted', responded_at = now() where id = p_trade_id;
  update public.trade_offers set status = 'cancelled' where id != p_trade_id and status = 'pending'
    and (offered_card_id = v_trade.offered_card_id or offered_card_id = v_wanted_id);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.decline_trade(p_trade_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.trade_offers set status = 'declined', responded_at = now()
  where id = p_trade_id and receiver_id = auth.uid() and status = 'pending';
end;
$$;

create or replace function public.cancel_trade(p_trade_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.trade_offers set status = 'cancelled'
  where id = p_trade_id and sender_id = auth.uid() and status = 'pending';
end;
$$;

create or replace function public.get_pending_trades()
returns table(id uuid, direction text, other_user_id uuid, other_username text, other_avatar_url text, offered_card_key text, offered_rarity text, wanted_card_key text, wanted_card_name text, wanted_rarity text, message text, created_at timestamptz, expires_at timestamptz)
language sql security definer as $$
  select t.id,
    case when t.sender_id = auth.uid() then 'sent' else 'received' end as direction,
    case when t.sender_id = auth.uid() then t.receiver_id else t.sender_id end as other_user_id,
    pp.username, pp.avatar_url, t.offered_card_key, t.offered_rarity,
    t.wanted_card_key, t.wanted_card_name, t.wanted_rarity, t.message, t.created_at, t.expires_at
  from public.trade_offers t
  join public.player_profiles pp on pp.user_id = case when t.sender_id = auth.uid() then t.receiver_id else t.sender_id end
  where (t.sender_id = auth.uid() or t.receiver_id = auth.uid()) and t.status = 'pending' and t.expires_at > now()
  order by t.created_at desc;
$$;

create or replace function public.get_friend_collection(p_friend_id uuid)
returns table(card_id text, rarity text, family text, qty bigint, metadata jsonb)
language sql security definer as $$
  select pc.card_id, pc.rarity, pc.family, count(*) as qty, max(pc.metadata) as metadata
  from public.player_cards pc
  where pc.user_id = p_friend_id
    and exists (select 1 from public.friendships f where f.status = 'accepted'
      and ((f.sender_id = auth.uid() and f.receiver_id = p_friend_id)
        or (f.receiver_id = auth.uid() and f.sender_id = p_friend_id)))
  group by pc.card_id, pc.rarity, pc.family;
$$;

-- ── Twitch RPC ────────────────────────────────────────────────────────────────
create or replace function public.link_twitch_account(p_twitch_id text, p_twitch_login text)
returns void language plpgsql security definer as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  update public.player_profiles set twitch_id = p_twitch_id, twitch_login = p_twitch_login where user_id = v_uid;
  update public.twitch_pending_codes set user_id = v_uid where twitch_user_id = p_twitch_id and user_id is null;
end;
$$;

create or replace function public.unlink_twitch_account()
returns void language plpgsql security definer as $$
begin
  update public.player_profiles set twitch_id = null, twitch_login = null where user_id = auth.uid();
end;
$$;

create or replace function public.get_pending_twitch_codes()
returns table(id bigint, code text, booster_type text, broadcaster_login text, created_at timestamptz)
language sql security definer as $$
  select id, code, booster_type, broadcaster_login, created_at
  from public.twitch_pending_codes where user_id = auth.uid() and claimed = false order by created_at asc;
$$;

create or replace function public.claim_pending_twitch_code(p_id bigint)
returns void language plpgsql security definer as $$
begin
  update public.twitch_pending_codes set claimed = true, claimed_at = now()
  where id = p_id and user_id = auth.uid() and claimed = false;
end;
$$;

create or replace function public.generate_twitch_booster_code(
  p_twitch_user_id text, p_twitch_login text, p_reward_id text,
  p_redemption_id text, p_broadcaster_id text, p_broadcaster_login text
)
returns table(code text, booster_type text, broadcaster_login text, error_reason text)
language plpgsql security definer as $$
declare v_user_id uuid; v_code text; v_reward public.twitch_rewards%rowtype;
begin
  select code_generated into v_code from public.twitch_eventsub_log
  where redemption_id = p_redemption_id and status = 'processed';
  if found and v_code is not null then
    return query select v_code, null::text, p_broadcaster_login, null::text; return;
  end if;
  select * into v_reward from public.twitch_rewards
  where reward_id = p_reward_id and broadcaster_id = p_broadcaster_id and active = true;
  if not found then
    insert into public.twitch_eventsub_log (broadcaster_id, broadcaster_login, twitch_user_id, twitch_login, reward_id, redemption_id, status, error_message)
    values (p_broadcaster_id, p_broadcaster_login, p_twitch_user_id, p_twitch_login, p_reward_id, p_redemption_id, 'error', 'reward_not_configured');
    return query select null::text, null::text, null::text, 'reward_not_configured'::text; return;
  end if;
  select user_id into v_user_id from public.player_profiles where twitch_id = p_twitch_user_id;
  v_code := upper(left(p_broadcaster_login, 3)) || '-' ||
    upper(substr(md5(random()::text), 1, 4)) || '-' || upper(substr(md5(p_redemption_id), 1, 4));
  insert into public.booster_codes (code, booster_type, created_by, max_redemptions, twitch_broadcaster_id)
  values (v_code, v_reward.booster_type, v_user_id, 1, p_broadcaster_id);
  insert into public.twitch_pending_codes (twitch_user_id, user_id, code, booster_type, broadcaster_login, broadcaster_id)
  values (p_twitch_user_id, v_user_id, v_code, v_reward.booster_type, p_broadcaster_login, p_broadcaster_id);
  insert into public.twitch_eventsub_log (broadcaster_id, broadcaster_login, twitch_user_id, twitch_login, reward_id, redemption_id, status, code_generated)
  values (p_broadcaster_id, p_broadcaster_login, p_twitch_user_id, p_twitch_login, p_reward_id, p_redemption_id, 'processed', v_code);
  if v_user_id is null then
    return query select v_code, v_reward.booster_type, p_broadcaster_login, 'twitch_account_not_linked'::text; return;
  end if;
  return query select v_code, v_reward.booster_type, p_broadcaster_login, null::text;
end;
$$;

create or replace function public.get_broadcaster_for_code(p_code text)
returns table(broadcaster_id text, broadcaster_login text, bot_access_token text)
language sql security definer as $$
  select s.broadcaster_id, s.broadcaster_login, s.bot_access_token
  from public.booster_codes bc join public.twitch_streamers s on s.broadcaster_id = bc.twitch_broadcaster_id
  where bc.code = p_code and s.active = true limit 1;
$$;

create or replace function public.log_rare_pull_for_twitch(p_card_name text, p_rarity text, p_broadcaster_id text, p_broadcaster_login text)
returns void language plpgsql security definer as $$
declare v_uid uuid := auth.uid(); v_twitch_login text;
begin
  if v_uid is null then return; end if;
  select twitch_login into v_twitch_login from public.player_profiles where user_id = v_uid;
  if v_twitch_login is null then return; end if;
  insert into public.twitch_rare_pull_log (user_id, twitch_login, broadcaster_id, broadcaster_login, card_name, rarity)
  values (v_uid, v_twitch_login, p_broadcaster_id, p_broadcaster_login, p_card_name, p_rarity);
end;
$$;

create or replace function public.credit_booster_by_twitch_id(p_twitch_id text, p_booster_type text default 'void', p_source_ref text default null, p_broadcaster_id text default null)
returns table(credit_id bigint, error_reason text) language plpgsql security definer as $$
declare v_user_id uuid;
begin
  select user_id into v_user_id from public.player_profiles where twitch_id = p_twitch_id limit 1;
  if not found then return query select null::bigint, 'twitch_account_not_linked'::text; return; end if;
  if p_source_ref is not null then
    if exists (select 1 from public.booster_credits where source_ref = p_source_ref) then
      return query select id, null::text from public.booster_credits where source_ref = p_source_ref limit 1; return;
    end if;
  end if;
  insert into public.booster_credits (user_id, booster_type, source, source_ref)
  values (v_user_id, p_booster_type, 'twitch_channel_points', p_source_ref)
  returning id into v_user_id;
  return query select v_user_id::bigint, null::text;
exception when unique_violation then
  return query select id, null::text from public.booster_credits where source_ref = p_source_ref limit 1;
end;
$$;

create or replace function public.get_pending_booster_credits()
returns table(id bigint, booster_type text, source text, created_at timestamptz)
language sql security definer as $$
  select id, booster_type, source, created_at from public.booster_credits
  where user_id = auth.uid() and claimed = false order by created_at asc;
$$;

create or replace function public.claim_booster_credit(p_id bigint)
returns void language plpgsql security definer as $$
begin
  update public.booster_credits set claimed = true, claimed_at = now()
  where id = p_id and user_id = auth.uid() and claimed = false;
end;
$$;

-- =========================================================
-- GRANTS
-- =========================================================
grant execute on function public.current_discord_id()                                                              to authenticated;
grant execute on function public.admin_current_identity_debug()                                                    to authenticated;
grant execute on function public.admin_is_current_user()                                                           to authenticated;
grant execute on function public.admin_is_discord_admin(text)                                                      to authenticated;
grant execute on function public.assert_discord_id_is_admin(text)                                                  to authenticated;
grant execute on function public.admin_generate_booster_codes_client(text, integer, text, timestamptz, integer, text) to authenticated;
grant execute on function public.admin_list_booster_codes(integer, text)                                           to authenticated;
grant execute on function public.admin_list_booster_redemptions(integer)                                           to authenticated;
grant execute on function public.admin_list_players(text, integer)                                                 to authenticated;
grant execute on function public.admin_get_player_detail(uuid, text)                                               to authenticated;
grant execute on function public.admin_save_custom_card_client(jsonb)                                              to authenticated;
grant execute on function public.admin_delete_custom_card_client(text, text)                                       to authenticated;
grant execute on function public.redeem_booster_code(text)                                                         to authenticated;
grant execute on function public.complete_booster_redemption(uuid, jsonb)                                          to authenticated;
grant execute on function public.list_custom_cards()                                                               to anon, authenticated;
grant execute on function public.get_or_create_pity_state()                                                        to authenticated;
grant execute on function public.update_pity_after_pack(jsonb)                                                     to authenticated;
grant execute on function public.claim_daily_reward()                                                              to authenticated;
grant execute on function public.get_pending_booster_credits()                                                     to authenticated;
grant execute on function public.claim_booster_credit(bigint)                                                      to authenticated;
grant execute on function public.get_pending_twitch_codes()                                                        to authenticated;
grant execute on function public.claim_pending_twitch_code(bigint)                                                 to authenticated;
grant execute on function public.link_twitch_account(text, text)                                                   to authenticated;
grant execute on function public.unlink_twitch_account()                                                           to authenticated;
grant execute on function public.join_matchmaking(jsonb)                                                           to authenticated;
grant execute on function public.leave_matchmaking()                                                               to authenticated;
grant execute on function public.submit_game_action(uuid, text, jsonb, jsonb)                                      to authenticated;
grant execute on function public.finish_game(uuid, uuid)                                                           to authenticated;
grant execute on function public.record_combat_result(uuid, uuid)                                                  to authenticated;
grant execute on function public.get_combat_ladder(integer)                                                        to authenticated;
grant execute on function public.get_friends()                                                                     to authenticated;
grant execute on function public.search_player(text)                                                               to authenticated;
grant execute on function public.get_conversation(uuid, integer)                                                   to authenticated;
grant execute on function public.mark_messages_read(uuid)                                                          to authenticated;
grant execute on function public.accept_challenge(uuid, jsonb)                                                     to authenticated;
grant execute on function public.accept_trade(uuid)                                                                to authenticated;
grant execute on function public.decline_trade(uuid)                                                               to authenticated;
grant execute on function public.cancel_trade(uuid)                                                                to authenticated;
grant execute on function public.get_pending_trades()                                                              to authenticated;
grant execute on function public.get_friend_collection(uuid)                                                       to authenticated;

notify pgrst, 'reload schema';
