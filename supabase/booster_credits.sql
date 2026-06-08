-- ═══════════════════════════════════════════════════════════════════════════════
-- VOID Pack — Système de crédits booster
-- Remplace les codes pour les distributions directes sur compte
-- À exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Table des crédits booster ─────────────────────────────────────────────
create table if not exists public.booster_credits (
  id                bigserial primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  booster_type      text not null default 'void',
  source            text not null default 'manual', -- 'manual' | 'twitch_channel_points' | 'admin'
  source_ref        text,                            -- ID de la rédemption Twitch, etc.
  claimed           boolean not null default false,
  claimed_at        timestamptz,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id)   -- admin qui a crédité (null si auto)
);

-- Index pour lookup rapide des crédits non réclamés par joueur
create index if not exists idx_booster_credits_user
  on public.booster_credits(user_id)
  where claimed = false;

-- Idempotence Twitch — évite les doublons si le webhook est reçu 2 fois
create unique index if not exists idx_booster_credits_source_ref
  on public.booster_credits(source_ref)
  where source_ref is not null;

-- ── 2. RPC : créditer un booster sur un compte (usage admin/Edge Function) ───
create or replace function public.credit_booster(
  p_user_id      uuid,
  p_booster_type text default 'void',
  p_source       text default 'manual',
  p_source_ref   text default null
)
returns table (credit_id bigint, error_reason text)
language plpgsql security definer
as $$
begin
  -- Idempotence : si source_ref déjà traité, retourner l'ID existant
  if p_source_ref is not null then
    if exists (select 1 from public.booster_credits where source_ref = p_source_ref) then
      return query
        select id, null::text
        from public.booster_credits
        where source_ref = p_source_ref
        limit 1;
      return;
    end if;
  end if;

  -- Créer le crédit
  insert into public.booster_credits (user_id, booster_type, source, source_ref)
  values (p_user_id, p_booster_type, p_source, p_source_ref)
  returning id into strict p_user_id; -- réutilise la variable pour récupérer l'ID

  return query select p_user_id::bigint, null::text;

exception when others then
  return query select null::bigint, sqlerrm;
end;
$$;

-- Version simplifiée sans gestion d'erreur pour l'admin
create or replace function public.credit_booster_to_user(
  p_user_id      uuid,
  p_booster_type text default 'void',
  p_source       text default 'admin'
)
returns bigint
language plpgsql security definer
as $$
declare
  v_id bigint;
begin
  if auth.role() not in ('service_role') then
    -- Vérifier que l'appelant est admin
    if not exists (
      select 1 from public.player_profiles
      where user_id = auth.uid() and is_admin = true
    ) then
      raise exception 'Non autorisé';
    end if;
  end if;

  insert into public.booster_credits (user_id, booster_type, source, created_by)
  values (p_user_id, p_booster_type, p_source, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- ── 3. RPC : récupérer les crédits en attente du joueur connecté ─────────────
create or replace function public.get_pending_booster_credits()
returns table (
  id            bigint,
  booster_type  text,
  source        text,
  created_at    timestamptz
)
language sql security definer
as $$
  select id, booster_type, source, created_at
  from public.booster_credits
  where user_id = auth.uid()
    and claimed = false
  order by created_at asc;
$$;

-- ── 4. RPC : réclamer un crédit (marquer comme utilisé) ──────────────────────
create or replace function public.claim_booster_credit(p_id bigint)
returns void
language plpgsql security definer
as $$
begin
  update public.booster_credits
  set claimed = true, claimed_at = now()
  where id = p_id
    and user_id = auth.uid()
    and claimed = false;
end;
$$;

-- ── 5. Twitch : créditer via twitch_id (Edge Function) ───────────────────────
create or replace function public.credit_booster_by_twitch_id(
  p_twitch_id    text,
  p_booster_type text default 'void',
  p_source_ref   text default null,
  p_broadcaster_id text default null
)
returns table (credit_id bigint, error_reason text)
language plpgsql security definer
as $$
declare
  v_user_id uuid;
begin
  -- Retrouver le joueur VOID Pack via son twitch_id
  select user_id into v_user_id
  from public.player_profiles
  where twitch_id = p_twitch_id
  limit 1;

  if not found then
    return query select null::bigint, 'twitch_account_not_linked'::text;
    return;
  end if;

  -- Idempotence
  if p_source_ref is not null then
    if exists (select 1 from public.booster_credits where source_ref = p_source_ref) then
      return query
        select id, null::text from public.booster_credits
        where source_ref = p_source_ref limit 1;
      return;
    end if;
  end if;

  -- Créer le crédit directement sur le compte
  insert into public.booster_credits
    (user_id, booster_type, source, source_ref)
  values
    (v_user_id, p_booster_type, 'twitch_channel_points', p_source_ref)
  returning id into v_user_id; -- réutilise pour l'ID

  return query select v_user_id::bigint, null::text;

exception when unique_violation then
  return query
    select id, null::text from public.booster_credits
    where source_ref = p_source_ref limit 1;
end;
$$;

-- ── 6. RLS ───────────────────────────────────────────────────────────────────
alter table public.booster_credits enable row level security;

-- Joueur : voir seulement ses propres crédits
create policy "own credits" on public.booster_credits
  for select using (user_id = auth.uid());

-- Service role : tout faire (Edge Functions)
create policy "service all" on public.booster_credits
  for all using (auth.role() = 'service_role');

-- ── 7. Vue admin ─────────────────────────────────────────────────────────────
create or replace view public.booster_credits_overview as
select
  bc.id,
  pp.username,
  pp.twitch_login,
  bc.booster_type,
  bc.source,
  bc.source_ref,
  bc.claimed,
  bc.claimed_at,
  bc.created_at
from public.booster_credits bc
join public.player_profiles pp on pp.user_id = bc.user_id
order by bc.created_at desc;
