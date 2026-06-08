-- ═══════════════════════════════════════════════════════════════════════
-- VOID Pack — Ladder Collection + Ladder Combat
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Stats combat (V/D/points de rang) ──────────────────────────────
create table if not exists public.combat_stats (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  wins           integer not null default 0,
  losses         integer not null default 0,
  rank_points    integer not null default 0,    -- points de rang actuels
  peak_points    integer not null default 0,    -- pic historique
  current_streak integer not null default 0,    -- série en cours (+ win, - loss)
  best_streak    integer not null default 0,
  season_wins    integer not null default 0,    -- victoires cette saison
  season_losses  integer not null default 0,
  updated_at     timestamptz not null default now()
);

-- ── 2. Saisons ─────────────────────────────────────────────────────────
create table if not exists public.combat_seasons (
  id           serial primary key,
  name         text not null,
  started_at   timestamptz not null default now(),
  ends_at      timestamptz not null,
  is_active    boolean not null default true,
  rewards      jsonb not null default '[]'  -- [{rank_min, rank_max, booster_type, qty}]
);

-- Insérer la première saison (30 jours)
insert into public.combat_seasons (name, started_at, ends_at, rewards)
values (
  'Saison 1 — Éveil du VOID',
  now(),
  now() + interval '30 days',
  '[
    {"rank": "void",     "min_points": 2000, "booster_type": "void",    "qty": 3},
    {"rank": "diamond",  "min_points": 1500, "booster_type": "void",    "qty": 2},
    {"rank": "platinum", "min_points": 1000, "booster_type": "harmony", "qty": 2},
    {"rank": "gold",     "min_points": 600,  "booster_type": "harmony", "qty": 1},
    {"rank": "silver",   "min_points": 300,  "booster_type": "void",    "qty": 1},
    {"rank": "bronze",   "min_points": 0,    "booster_type": "void",    "qty": 0}
  ]'::jsonb
)
on conflict do nothing;

-- ── 3. Historique des lots de saison ──────────────────────────────────
create table if not exists public.season_rewards (
  id          bigserial primary key,
  season_id   integer not null references public.combat_seasons(id),
  user_id     uuid not null references auth.users(id) on delete cascade,
  rank        text not null,
  rank_points integer not null,
  booster_type text not null,
  qty         integer not null default 0,
  claimed     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── 4. RLS ─────────────────────────────────────────────────────────────
alter table public.combat_stats    enable row level security;
alter table public.combat_seasons  enable row level security;
alter table public.season_rewards  enable row level security;

create policy "read combat stats" on public.combat_stats
  for select using (true);  -- classement public
create policy "own combat stats" on public.combat_stats
  for all using (user_id = auth.uid());

create policy "read seasons" on public.combat_seasons
  for select using (true);

create policy "own season rewards" on public.season_rewards
  for select using (user_id = auth.uid());

-- ── 5. Realtime ────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.combat_stats;

-- ── 6. Rang à partir des points ────────────────────────────────────────
create or replace function public.get_rank_from_points(p_points integer)
returns text language sql immutable as $$
  select case
    when p_points >= 2000 then 'void'
    when p_points >= 1500 then 'diamond'
    when p_points >= 1000 then 'platinum'
    when p_points >= 600  then 'gold'
    when p_points >= 300  then 'silver'
    else 'bronze'
  end;
$$;

-- ── 7. RPC : mettre à jour les stats après un combat ──────────────────
create or replace function public.record_combat_result(
  p_session_id uuid,
  p_winner_id  uuid
)
returns void
language plpgsql security definer
as $$
declare
  v_session   public.game_sessions;
  v_loser_id  uuid;
  v_win_pts   integer := 25;
  v_loss_pts  integer := -15;
begin
  select * into v_session
  from public.game_sessions
  where id = p_session_id;

  if not found then return; end if;

  v_loser_id := case
    when v_session.player1_id = p_winner_id then v_session.player2_id
    else v_session.player1_id
  end;

  -- Mettre à jour le gagnant
  insert into public.combat_stats (user_id, wins, rank_points, peak_points, current_streak, best_streak, season_wins)
  values (p_winner_id, 1, v_win_pts, v_win_pts, 1, 1, 1)
  on conflict (user_id) do update set
    wins           = combat_stats.wins + 1,
    rank_points    = greatest(0, combat_stats.rank_points + v_win_pts),
    peak_points    = greatest(combat_stats.peak_points, combat_stats.rank_points + v_win_pts),
    current_streak = greatest(0, combat_stats.current_streak) + 1,
    best_streak    = greatest(combat_stats.best_streak, greatest(0, combat_stats.current_streak) + 1),
    season_wins    = combat_stats.season_wins + 1,
    updated_at     = now();

  -- Mettre à jour le perdant
  insert into public.combat_stats (user_id, losses, rank_points, current_streak, season_losses)
  values (v_loser_id, 1, 0, -1, 1)
  on conflict (user_id) do update set
    losses         = combat_stats.losses + 1,
    rank_points    = greatest(0, combat_stats.rank_points + v_loss_pts),
    current_streak = least(0, combat_stats.current_streak) - 1,
    season_losses  = combat_stats.season_losses + 1,
    updated_at     = now();
end;
$$;

-- ── 8. Ladder collection (vue publique) ────────────────────────────────
create or replace function public.get_collection_ladder(p_limit int default 50)
returns table (
  rank          bigint,
  user_id       uuid,
  username      text,
  avatar_url    text,
  level         integer,
  xp            integer,
  packs_opened  integer,
  highest_rarity text,
  void_pulls    integer,
  card_count    bigint,
  achievements  jsonb
)
language sql security definer
as $$
  select
    row_number() over (order by pp.xp desc, pp.packs_opened desc) as rank,
    pp.user_id,
    pp.username,
    pp.avatar_url,
    pp.level,
    pp.xp,
    pp.packs_opened,
    pp.highest_rarity,
    pp.void_pulls,
    coalesce(cc.card_count, 0),
    coalesce(ach.achievements, '[]'::jsonb)
  from public.player_profiles pp
  left join (
    select user_id, count(distinct card_id) as card_count
    from public.user_cards
    group by user_id
  ) cc on cc.user_id = pp.user_id
  left join (
    select user_id,
      jsonb_agg(jsonb_build_object(
        'id', achievement_id,
        'unlocked_at', unlocked_at
      ) order by unlocked_at) as achievements
    from public.user_achievements
    group by user_id
  ) ach on ach.user_id = pp.user_id
  where pp.username is not null
  order by pp.xp desc, pp.packs_opened desc
  limit p_limit;
$$;

-- ── 9. Ladder combat (vue publique) ────────────────────────────────────
create or replace function public.get_combat_ladder(p_limit int default 50)
returns table (
  rank          bigint,
  user_id       uuid,
  username      text,
  avatar_url    text,
  level         integer,
  rank_points   integer,
  rank_name     text,
  wins          integer,
  losses        integer,
  win_rate      numeric,
  best_streak   integer,
  season_wins   integer
)
language sql security definer
as $$
  select
    row_number() over (order by cs.rank_points desc, cs.wins desc) as rank,
    pp.user_id,
    pp.username,
    pp.avatar_url,
    pp.level,
    cs.rank_points,
    public.get_rank_from_points(cs.rank_points) as rank_name,
    cs.wins,
    cs.losses,
    case when cs.wins + cs.losses > 0
      then round(cs.wins::numeric / (cs.wins + cs.losses) * 100, 1)
      else 0
    end as win_rate,
    cs.best_streak,
    cs.season_wins
  from public.combat_stats cs
  join public.player_profiles pp on pp.user_id = cs.user_id
  where cs.wins + cs.losses > 0
  order by cs.rank_points desc, cs.wins desc
  limit p_limit;
$$;
