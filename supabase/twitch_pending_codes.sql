-- ═══════════════════════════════════════════════════════════════════════════════
-- VOID Pack — Codes boosters Twitch en attente
-- Complément de twitch_integration.sql
-- À exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Table des codes en attente par joueur ─────────────────────────────────────
-- Quand un viewer rachète des Channel Points, son code est stocké ici.
-- L'app le détecte à la prochaine connexion et affiche la bannière.
create table if not exists public.twitch_pending_codes (
  id                  bigserial primary key,
  twitch_user_id      text not null,          -- ID Twitch du viewer
  user_id             uuid references auth.users(id), -- lié au compte VOID Pack
  code                text not null,          -- Code booster généré
  booster_type        text not null default 'void',
  broadcaster_login   text,                   -- Streamer source (pour affichage)
  broadcaster_id      text,
  claimed             boolean not null default false,
  claimed_at          timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists idx_pending_codes_user_id
  on public.twitch_pending_codes(user_id)
  where claimed = false;

create index if not exists idx_pending_codes_twitch_id
  on public.twitch_pending_codes(twitch_user_id)
  where claimed = false;

-- ── Modifier generate_twitch_booster_code pour stocker le code en pending ─────
-- (remplace la version précédente)
create or replace function public.generate_twitch_booster_code(
  p_twitch_user_id    text,
  p_twitch_login      text,
  p_reward_id         text,
  p_redemption_id     text,
  p_broadcaster_id    text,
  p_broadcaster_login text
)
returns table (
  code              text,
  booster_type      text,
  broadcaster_login text,
  error_reason      text
)
language plpgsql security definer
as $$
declare
  v_user_id         uuid;
  v_code            text;
  v_reward          public.twitch_rewards%rowtype;
begin
  -- Idempotence
  select code_generated into v_code
  from public.twitch_eventsub_log
  where redemption_id = p_redemption_id and status = 'processed';

  if found and v_code is not null then
    return query select v_code, null::text, p_broadcaster_login, null::text;
    return;
  end if;

  -- Vérifier la récompense (liée à ce broadcaster)
  select * into v_reward
  from public.twitch_rewards
  where reward_id = p_reward_id
    and broadcaster_id = p_broadcaster_id
    and active = true;

  if not found then
    insert into public.twitch_eventsub_log
      (broadcaster_id, broadcaster_login, twitch_user_id, twitch_login,
       reward_id, redemption_id, status, error_message)
    values
      (p_broadcaster_id, p_broadcaster_login, p_twitch_user_id, p_twitch_login,
       p_reward_id, p_redemption_id, 'error', 'reward_not_configured');
    return query select null::text, null::text, null::text, 'reward_not_configured'::text;
    return;
  end if;

  -- Retrouver le joueur VOID Pack (peut être null si pas encore lié)
  select user_id into v_user_id
  from public.player_profiles
  where twitch_id = p_twitch_user_id;

  -- Générer le code (format: STR-XXXX-XXXX)
  v_code := upper(left(p_broadcaster_login, 3)) || '-' ||
    upper(substr(md5(random()::text), 1, 4)) || '-' ||
    upper(substr(md5(p_redemption_id), 1, 4));

  -- Insérer dans booster_codes
  insert into public.booster_codes
    (code, booster_type, created_by, max_redemptions, active, twitch_broadcaster_id)
  values
    (v_code, v_reward.booster_type, v_user_id, 1, true, p_broadcaster_id);

  -- Stocker en "pending" pour affichage dans l'app
  -- (user_id peut être null si le compte n'est pas encore lié — on le retrouvera via twitch_user_id)
  insert into public.twitch_pending_codes
    (twitch_user_id, user_id, code, booster_type, broadcaster_login, broadcaster_id)
  values
    (p_twitch_user_id, v_user_id, v_code, v_reward.booster_type, p_broadcaster_login, p_broadcaster_id);

  -- Logger
  insert into public.twitch_eventsub_log
    (broadcaster_id, broadcaster_login, twitch_user_id, twitch_login,
     reward_id, redemption_id, status, code_generated)
  values
    (p_broadcaster_id, p_broadcaster_login, p_twitch_user_id, p_twitch_login,
     p_reward_id, p_redemption_id, 'processed', v_code);

  -- Cas sans compte lié : retourner quand même le code (annonce chat alternative)
  if v_user_id is null then
    return query select v_code, v_reward.booster_type, p_broadcaster_login, 'twitch_account_not_linked'::text;
    return;
  end if;

  return query select v_code, v_reward.booster_type, p_broadcaster_login, null::text;
end;
$$;

-- ── RPC : récupérer les codes pending d'un joueur ────────────────────────────
create or replace function public.get_pending_twitch_codes()
returns table (
  id                bigint,
  code              text,
  booster_type      text,
  broadcaster_login text,
  created_at        timestamptz
)
language sql security definer
as $$
  select id, code, booster_type, broadcaster_login, created_at
  from public.twitch_pending_codes
  where user_id = auth.uid()
    and claimed = false
  order by created_at asc;
$$;

-- ── RPC : marquer un code comme réclamé ──────────────────────────────────────
create or replace function public.claim_pending_twitch_code(p_id bigint)
returns void language plpgsql security definer as $$
begin
  update public.twitch_pending_codes
  set claimed = true, claimed_at = now()
  where id = p_id
    and user_id = auth.uid()
    and claimed = false;
end;
$$;

-- ── RPC : lier les codes orphelins quand un joueur lie son compte Twitch ──────
-- Appelée après link_twitch_account pour rattacher les codes en attente
create or replace function public.link_twitch_account(
  p_twitch_id    text,
  p_twitch_login text
) returns void language plpgsql security definer as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;

  update public.player_profiles
  set twitch_id = p_twitch_id, twitch_login = p_twitch_login
  where user_id = v_uid;

  -- Rattacher les codes orphelins générés avant la liaison de compte
  update public.twitch_pending_codes
  set user_id = v_uid
  where twitch_user_id = p_twitch_id
    and user_id is null;
end;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.twitch_pending_codes enable row level security;

-- Les joueurs ne peuvent voir que leurs propres codes
create policy "own codes only" on public.twitch_pending_codes
  for select using (user_id = auth.uid());

-- Le service role peut tout faire (Edge Function)
create policy "service write" on public.twitch_pending_codes
  for all using (auth.role() = 'service_role');
