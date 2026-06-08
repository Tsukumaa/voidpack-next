create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,

  username text not null,
  avatar_url text,

  level integer not null default 1,
  xp integer not null default 0,

  packs_opened integer not null default 0,
  highest_rarity text,
  void_pulls integer not null default 0,

  current_streak integer not null default 0,
  best_streak integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_profiles enable row level security;

create policy "player_profiles_select_own"
on public.player_profiles
for select
using (auth.uid() = user_id);

create policy "player_profiles_insert_own"
on public.player_profiles
for insert
with check (auth.uid() = user_id);

create policy "player_profiles_update_own"
on public.player_profiles
for update
using (auth.uid() = user_id);

create table if not exists public.opening_history (
  id bigint generated always as identity primary key,

  user_id uuid not null references auth.users(id) on delete cascade,

  card_id text not null,
  rarity text not null,
  booster_type text,

  created_at timestamptz not null default now()
);

alter table public.opening_history enable row level security;

create policy "opening_history_select_own"
on public.opening_history
for select
using (auth.uid() = user_id);

create policy "opening_history_insert_own"
on public.opening_history
for insert
with check (auth.uid() = user_id);

create index opening_history_user_id_idx
on public.opening_history(user_id);

create index opening_history_created_at_idx
on public.opening_history(created_at desc);
