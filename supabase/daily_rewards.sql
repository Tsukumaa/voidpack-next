create table if not exists public.player_daily_rewards (
  user_id uuid primary key references auth.users(id) on delete cascade,

  last_claim_at timestamptz,
  current_streak integer not null default 0,
  best_streak integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_daily_rewards enable row level security;

drop policy if exists "player_daily_rewards_select_own" on public.player_daily_rewards;
create policy "player_daily_rewards_select_own"
on public.player_daily_rewards
for select
using (auth.uid() = user_id);

drop policy if exists "player_daily_rewards_insert_own" on public.player_daily_rewards;
create policy "player_daily_rewards_insert_own"
on public.player_daily_rewards
for insert
with check (auth.uid() = user_id);

drop policy if exists "player_daily_rewards_update_own" on public.player_daily_rewards;
create policy "player_daily_rewards_update_own"
on public.player_daily_rewards
for update
using (auth.uid() = user_id);

create index if not exists player_daily_rewards_last_claim_at_idx
on public.player_daily_rewards(last_claim_at desc);

-- =========================================================
-- RPC : claim_daily_reward
-- Atomique : vérifie le cooldown, met à jour le streak,
-- génère un code booster et le retourne en une seule transaction.
--
-- Retourne :
--   ok            boolean
--   error_code    text (null si ok)
--   current_streak integer
--   best_streak    integer
--   booster_code   text  — le code à entrer dans l'input
--   booster_type   text
--   bonus_packs    integer
-- =========================================================

create or replace function public.claim_daily_reward()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id        uuid := auth.uid();
  v_daily          public.player_daily_rewards%rowtype;
  v_now            timestamptz := now();
  v_hours_since    numeric;
  v_streak_reset   boolean;
  v_new_streak     integer;
  v_best_streak    integer;
  v_bonus_packs    integer;
  v_total_packs    integer;
  v_code           text;
  v_inserted_code  public.booster_codes%rowtype;
  v_attempts       integer := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED');
  end if;

  -- Charger ou créer l'état daily
  insert into public.player_daily_rewards (user_id, last_claim_at, current_streak, best_streak)
  values (v_user_id, null, 0, 0)
  on conflict (user_id) do nothing;

  select * into v_daily
  from public.player_daily_rewards
  where user_id = v_user_id
  for update; -- lock row pour éviter double-claim concurrent

  -- Vérifier le cooldown (20h)
  if v_daily.last_claim_at is not null then
    v_hours_since := extract(epoch from (v_now - v_daily.last_claim_at)) / 3600;
    if v_hours_since < 20 then
      return jsonb_build_object(
        'ok',            false,
        'error_code',    'ALREADY_CLAIMED',
        'hours_remaining', ceil(20 - v_hours_since)::integer
      );
    end if;
    -- Reset streak si plus de 48h
    v_streak_reset := v_hours_since > 48;
  else
    v_streak_reset := false;
  end if;

  -- Calculer le nouveau streak
  v_new_streak  := case when v_streak_reset then 1 else v_daily.current_streak + 1 end;
  v_best_streak := greatest(v_daily.best_streak, v_new_streak);

  -- Bonus tous les 7 jours
  v_bonus_packs := case when v_new_streak % 7 = 0 then 1 else 0 end;
  v_total_packs := 1 + v_bonus_packs;

  -- Mettre à jour l'état daily
  update public.player_daily_rewards set
    last_claim_at  = v_now,
    current_streak = v_new_streak,
    best_streak    = v_best_streak,
    updated_at     = v_now
  where user_id = v_user_id;

  -- Générer le(s) code(s) booster — un code avec max_redemptions = total_packs
  loop
    v_code := public.make_booster_code('DAILY');
    begin
      insert into public.booster_codes (
        code, booster_type, status, max_redemptions,
        redeemed_count, expires_at, created_by, metadata
      ) values (
        v_code,
        'void',
        'active',
        v_total_packs,
        0,
        v_now + interval '48 hours', -- expire dans 48h
        v_user_id,
        jsonb_build_object(
          'created_via', 'daily_reward',
          'streak',      v_new_streak,
          'bonus_packs', v_bonus_packs
        )
      )
      returning * into v_inserted_code;
      exit; -- succès, on sort du loop
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts >= 5 then
        return jsonb_build_object('ok', false, 'error_code', 'CODE_GENERATION_FAILED');
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'ok',            true,
    'current_streak', v_new_streak,
    'best_streak',    v_best_streak,
    'bonus_packs',    v_bonus_packs,
    'total_packs',    v_total_packs,
    'booster_code',   v_code,
    'booster_type',   'void',
    'streak_reset',   v_streak_reset
  );
end;
$$;

grant execute on function public.claim_daily_reward() to authenticated;
