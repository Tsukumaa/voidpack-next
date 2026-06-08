-- =========================================================
-- VOID Pack — Admin : stats joueurs
-- À exécuter dans Supabase SQL Editor.
-- =========================================================

-- ── RPC : admin_list_players ───────────────────────────────────────────────
-- Liste tous les joueurs avec leurs stats résumées.
-- Accessible uniquement aux admins vérifiés.

create or replace function public.admin_list_players(
  input_admin_discord_id text default null,
  input_limit integer default 200
)
returns table(
  user_id         uuid,
  username        text,
  avatar_url      text,
  level           integer,
  xp              integer,
  packs_opened    integer,
  void_pulls      integer,
  highest_rarity  text,
  current_streak  integer,
  best_streak     integer,
  card_count      bigint,
  last_active     timestamptz,
  created_at      timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_discord_id_is_admin(input_admin_discord_id);

  return query
  select
    p.user_id,
    p.username,
    p.avatar_url,
    p.level,
    p.xp,
    p.packs_opened,
    p.void_pulls,
    p.highest_rarity,
    p.current_streak,
    p.best_streak,
    count(pc.id)        as card_count,
    max(pc.obtained_at) as last_active,
    p.created_at
  from public.player_profiles p
  left join public.player_cards pc on pc.user_id = p.user_id
  group by
    p.user_id, p.username, p.avatar_url, p.level, p.xp,
    p.packs_opened, p.void_pulls, p.highest_rarity,
    p.current_streak, p.best_streak, p.created_at
  order by last_active desc nulls last
  limit input_limit;
end;
$$;

grant execute on function public.admin_list_players(text, integer) to authenticated;


-- ── RPC : admin_get_player_detail ─────────────────────────────────────────
-- Retourne la collection complète d'un joueur (pour export physique).
-- Triée par rareté desc puis date desc.

create or replace function public.admin_get_player_detail(
  input_user_id           uuid,
  input_admin_discord_id  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile   public.player_profiles%rowtype;
  v_cards     jsonb;
  v_pity      jsonb;
  v_daily     jsonb;
begin
  perform public.assert_discord_id_is_admin(input_admin_discord_id);

  -- Profil
  select * into v_profile
  from public.player_profiles
  where user_id = input_user_id;

  -- Collection complète, triée rareté desc → date desc
  select jsonb_agg(
    jsonb_build_object(
      'id',          pc.id,
      'card_id',     pc.card_id,
      'rarity',      pc.rarity,
      'family',      pc.family,
      'obtained_at', pc.obtained_at,
      'name',        pc.metadata->>'name',
      'image',       pc.metadata->>'image',
      'source',      pc.metadata->>'source',
      'redemption_id', pc.metadata->>'redemption_id'
    )
    order by
      case pc.rarity
        when 'void'      then 5
        when 'legendary' then 4
        when 'epic'      then 3
        when 'rare'      then 2
        else 1
      end desc,
      pc.obtained_at desc
  )
  into v_cards
  from public.player_cards pc
  where pc.user_id = input_user_id;

  -- Pity state
  select jsonb_build_object(
    'packs_since_legendary', pps.packs_since_legendary,
    'packs_since_void',      pps.packs_since_void,
    'total_packs_opened',    pps.total_packs_opened,
    'last_legendary_at',     pps.last_legendary_at,
    'last_void_at',          pps.last_void_at
  )
  into v_pity
  from public.player_pity_state pps
  where pps.user_id = input_user_id;

  -- Daily state
  select jsonb_build_object(
    'current_streak', pdr.current_streak,
    'best_streak',    pdr.best_streak,
    'last_claim_at',  pdr.last_claim_at
  )
  into v_daily
  from public.player_daily_rewards pdr
  where pdr.user_id = input_user_id;

  return jsonb_build_object(
    'user_id',     input_user_id,
    'username',    v_profile.username,
    'avatar_url',  v_profile.avatar_url,
    'level',       v_profile.level,
    'xp',          v_profile.xp,
    'packs_opened', v_profile.packs_opened,
    'void_pulls',  v_profile.void_pulls,
    'highest_rarity', v_profile.highest_rarity,
    'created_at',  v_profile.created_at,
    'cards',       coalesce(v_cards, '[]'::jsonb),
    'pity',        coalesce(v_pity, '{}'::jsonb),
    'daily',       coalesce(v_daily, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.admin_get_player_detail(uuid, text) to authenticated;
