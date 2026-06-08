create table if not exists public.player_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,

  achievement_id text not null,
  unlocked_at timestamptz not null default now(),

  primary key (user_id, achievement_id)
);

alter table public.player_achievements enable row level security;

create policy "player_achievements_select_own"
on public.player_achievements
for select
using (auth.uid() = user_id);

create policy "player_achievements_insert_own"
on public.player_achievements
for insert
with check (auth.uid() = user_id);

create index if not exists player_achievements_unlocked_at_idx
on public.player_achievements(unlocked_at desc);
