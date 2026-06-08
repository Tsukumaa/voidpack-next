-- VOID Pack · Clean SQL baseline
-- À exécuter entièrement dans Supabase SQL Editor.
-- Objectif : tables + RPC propres pour codes boosters/admin, sans gen_random_bytes.

-- =========================================================
-- Extensions utiles
-- =========================================================
create extension if not exists pgcrypto;

-- =========================================================
-- Collection joueur
-- =========================================================
create table if not exists public.player_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null,
  rarity text not null check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'void')),
  family text not null default 'global',
  obtained_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.player_cards
  add column if not exists family text not null default 'global',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.player_cards enable row level security;

drop policy if exists "Players can read their own cards" on public.player_cards;
create policy "Players can read their own cards"
  on public.player_cards
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Players can add their own cards" on public.player_cards;
create policy "Players can add their own cards"
  on public.player_cards
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create index if not exists player_cards_user_id_idx on public.player_cards (user_id);
create index if not exists player_cards_user_card_idx on public.player_cards (user_id, card_id);
create index if not exists player_cards_user_family_idx on public.player_cards (user_id, family);
create index if not exists player_cards_user_obtained_idx on public.player_cards (user_id, obtained_at desc);

-- =========================================================
-- Codes boosters + redemptions
-- Module 11 : booster_type porte l'économie réelle du pack (void global ou pack famille).
-- =========================================================
create table if not exists public.booster_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  booster_type text not null default 'void' check (booster_type in ('void', 'harmony', 'pacific-bluffs', 'neon-divide', 'ash-district')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  max_redemptions integer not null default 1 check (max_redemptions > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.booster_codes
  add column if not exists booster_type text not null default 'void',
  add column if not exists status text not null default 'active',
  add column if not exists max_redemptions integer not null default 1,
  add column if not exists redeemed_count integer not null default 0,
  add column if not exists expires_at timestamptz,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.booster_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.booster_codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  redeemed_at timestamptz not null default now(),
  completed_at timestamptz,
  cards jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.booster_code_redemptions
  add column if not exists status text not null default 'pending',
  add column if not exists redeemed_at timestamptz not null default now(),
  add column if not exists completed_at timestamptz,
  add column if not exists cards jsonb not null default '[]'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.booster_codes enable row level security;
alter table public.booster_code_redemptions enable row level security;

create index if not exists booster_codes_code_idx on public.booster_codes (code);
create index if not exists booster_codes_status_expires_idx on public.booster_codes (status, expires_at);
create index if not exists booster_redemptions_code_idx on public.booster_code_redemptions (code_id);
create index if not exists booster_redemptions_user_idx on public.booster_code_redemptions (user_id, redeemed_at desc);
create unique index if not exists booster_redemptions_one_per_user_code_idx
  on public.booster_code_redemptions (code_id, user_id);

drop policy if exists "Players can read their own booster redemptions" on public.booster_code_redemptions;
create policy "Players can read their own booster redemptions"
  on public.booster_code_redemptions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Aucun accès direct aux codes côté client : tout passe par RPC security definer.
revoke all on public.booster_codes from anon, authenticated;
revoke all on public.booster_code_redemptions from anon, authenticated;
grant select, insert on public.player_cards to authenticated;

-- =========================================================
-- Admin users
-- =========================================================
create table if not exists public.admin_users (
  discord_id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  label text,
  created_at timestamptz not null default now()
);

alter table public.admin_users
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists label text,
  add column if not exists created_at timestamptz not null default now();

alter table public.admin_users enable row level security;

-- Module 12 : aucune policy directe sur admin_users.
-- Tous les accès admin passent par RPC security definer afin d'éviter
-- les policies fragiles basées sur user_metadata.
drop policy if exists "admin users can read self" on public.admin_users;
drop policy if exists "admin users can read matching discord id" on public.admin_users;
drop policy if exists "Admin users can read admin users" on public.admin_users;
revoke all on public.admin_users from anon, authenticated;

-- =========================================================
-- Nettoyage anciennes fonctions admin/code qui causaient les erreurs
-- =========================================================
drop function if exists public.admin_generate_booster_codes(text, integer, text, timestamptz, integer);
drop function if exists public.admin_generate_booster_codes_client(text, integer, text, timestamptz, integer);
drop function if exists public.admin_generate_booster_codes_client(text, integer, text, timestamptz, integer, text);
drop function if exists public.admin_list_booster_codes(integer);
drop function if exists public.admin_list_booster_codes(integer, text);
drop function if exists public.admin_list_booster_redemptions(integer);
drop function if exists public.admin_is_current_user();
drop function if exists public.admin_is_discord_admin(text);
drop function if exists public.assert_current_user_is_admin();
drop function if exists public.assert_discord_id_is_admin(text);
drop function if exists public.current_discord_id();
drop function if exists public.admin_current_identity_debug();

-- =========================================================
-- Helpers admin robustes
-- =========================================================
create or replace function public.current_discord_id()
returns text
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  metadata jsonb := '{}'::jsonb;
  identity_metadata jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;

  select coalesce(raw_user_meta_data, '{}'::jsonb)
    into metadata
  from auth.users
  where id = auth.uid();

  select coalesce(identity_data, '{}'::jsonb)
    into identity_metadata
  from auth.identities
  where user_id = auth.uid()
    and provider = 'discord'
  order by created_at desc
  limit 1;

  return nullif(trim(coalesce(
    metadata ->> 'provider_id',
    metadata ->> 'discord_id',
    metadata ->> 'user_id',
    metadata ->> 'sub',
    identity_metadata ->> 'provider_id',
    identity_metadata ->> 'discord_id',
    identity_metadata ->> 'user_id',
    identity_metadata ->> 'sub',
    auth.jwt() -> 'user_metadata' ->> 'provider_id',
    auth.jwt() -> 'user_metadata' ->> 'discord_id',
    auth.jwt() -> 'user_metadata' ->> 'user_id',
    auth.jwt() -> 'user_metadata' ->> 'sub',
    ''
  )), '');
end;
$$;

create or replace function public.admin_current_identity_debug()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  metadata jsonb := '{}'::jsonb;
  identity_metadata jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('authenticated', false);
  end if;

  select coalesce(raw_user_meta_data, '{}'::jsonb)
    into metadata
  from auth.users
  where id = auth.uid();

  select coalesce(identity_data, '{}'::jsonb)
    into identity_metadata
  from auth.identities
  where user_id = auth.uid()
    and provider = 'discord'
  order by created_at desc
  limit 1;

  return jsonb_build_object(
    'authenticated', true,
    'user_id', auth.uid(),
    'discord_id', public.current_discord_id(),
    'is_admin', public.admin_is_current_user(),
    'user_metadata', metadata,
    'identity_data', identity_metadata
  );
end;
$$;

create or replace function public.admin_is_current_user()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  did text;
begin
  if auth.uid() is null then
    return false;
  end if;

  did := public.current_discord_id();

  if did is null or did = '' then
    return false;
  end if;

  return exists (
    select 1
    from public.admin_users admins
    where trim(admins.discord_id) = trim(did)
  );
end;
$$;

create or replace function public.admin_is_discord_admin(input_discord_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  did text;
  client_did text;
begin
  if auth.uid() is null then
    return false;
  end if;

  did := public.current_discord_id();
  client_did := nullif(trim(coalesce(input_discord_id, '')), '');

  -- On accepte le Discord ID serveur OU le Discord ID extrait côté client.
  -- Cela évite les faux négatifs quand Supabase/Discord expose l'id dans un champ différent.
  return exists (
    select 1
    from public.admin_users admins
    where trim(admins.discord_id) = trim(coalesce(did, ''))
       or (client_did is not null and trim(admins.discord_id) = client_did)
  );
end;
$$;

create or replace function public.assert_discord_id_is_admin(input_discord_id text default null)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  did text;
  client_did text;
begin
  if auth.uid() is null then
    raise exception 'Connexion Discord requise.';
  end if;

  did := public.current_discord_id();
  client_did := nullif(trim(coalesce(input_discord_id, '')), '');

  if exists (
    select 1
    from public.admin_users admins
    where trim(admins.discord_id) = trim(coalesce(did, ''))
       or (client_did is not null and trim(admins.discord_id) = client_did)
  ) then
    return;
  end if;

  raise exception 'Accès admin refusé. Discord ID serveur : %, Discord ID client : %', coalesce(did, 'inconnu'), coalesce(client_did, 'inconnu');
end;
$$;

create or replace function public.assert_current_user_is_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_discord_id_is_admin(null);
end;
$$;

create or replace function public.make_booster_code(input_prefix text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  safe_prefix text;
  body_a text;
  body_b text;
begin
  safe_prefix := upper(regexp_replace(coalesce(input_prefix, 'VOID'), '[^A-Za-z0-9]+', '', 'g'));
  if safe_prefix = '' then
    safe_prefix := 'VOID';
  end if;

  -- Pas de gen_random_bytes : évite l'erreur pgcrypto sur certaines instances.
  body_a := upper(substr(md5(random()::text || clock_timestamp()::text || txid_current()::text), 1, 4));
  body_b := upper(substr(md5(random()::text || clock_timestamp()::text || txid_current()::text), 1, 4));
  return safe_prefix || '-' || body_a || '-' || body_b;
end;
$$;

-- =========================================================
-- RPC admin attendues par src/admin.js
-- =========================================================
create or replace function public.admin_generate_booster_codes_client(
  input_prefix text default 'VOID',
  input_count integer default 10,
  input_booster_type text default 'void',
  input_expires_at timestamptz default null,
  input_max_redemptions integer default 1,
  input_admin_discord_id text default null
)
returns table(
  id uuid,
  code text,
  booster_type text,
  status text,
  max_redemptions integer,
  redeemed_count integer,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_code text;
  inserted public.booster_codes%rowtype;
  inserted_count integer := 0;
begin
  perform public.assert_discord_id_is_admin(input_admin_discord_id);

  if input_count < 1 or input_count > 100 then
    raise exception 'input_count doit être entre 1 et 100.';
  end if;

  if input_max_redemptions < 1 or input_max_redemptions > 999 then
    raise exception 'input_max_redemptions doit être entre 1 et 999.';
  end if;

  if input_booster_type not in ('void', 'harmony', 'pacific-bluffs', 'neon-divide', 'ash-district') then
    raise exception 'Type de booster invalide.';
  end if;

  while inserted_count < input_count loop
    generated_code := public.make_booster_code(input_prefix);

    begin
      insert into public.booster_codes (code, booster_type, expires_at, max_redemptions, redeemed_count, status, created_by, metadata)
      values (
        generated_code,
        input_booster_type,
        input_expires_at,
        input_max_redemptions,
        0,
        'active',
        auth.uid(),
        jsonb_build_object('created_via', 'void_pack_admin_panel')
      )
      returning * into inserted;

      id := inserted.id;
      code := inserted.code;
      booster_type := inserted.booster_type;
      status := inserted.status;
      max_redemptions := inserted.max_redemptions;
      redeemed_count := inserted.redeemed_count;
      expires_at := inserted.expires_at;
      created_at := inserted.created_at;
      inserted_count := inserted_count + 1;
      return next;
    exception when unique_violation then
      -- Collision rare : on réessaie.
    end;
  end loop;
end;
$$;

create or replace function public.admin_list_booster_codes(input_limit integer default 100, input_admin_discord_id text default null)
returns table(
  id uuid,
  code text,
  booster_type text,
  status text,
  max_redemptions integer,
  redeemed_count integer,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_discord_id_is_admin(input_admin_discord_id);

  return query
  select c.id, c.code, c.booster_type, c.status, c.max_redemptions, c.redeemed_count, c.expires_at, c.created_at
  from public.booster_codes c
  order by c.created_at desc
  limit greatest(1, least(coalesce(input_limit, 100), 500));
end;
$$;

create or replace function public.admin_list_booster_redemptions(input_limit integer default 100)
returns table(
  id uuid,
  code text,
  booster_type text,
  user_id uuid,
  status text,
  redeemed_at timestamptz,
  completed_at timestamptz,
  cards jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_current_user_is_admin();

  return query
  select r.id, c.code, c.booster_type, r.user_id, r.status, r.redeemed_at, r.completed_at, r.cards
  from public.booster_code_redemptions r
  join public.booster_codes c on c.id = r.code_id
  order by r.redeemed_at desc
  limit greatest(1, least(coalesce(input_limit, 100), 500));
end;
$$;

-- =========================================================
-- RPC joueur : redeem + complete
-- =========================================================
drop function if exists public.redeem_booster_code(text);
drop function if exists public.complete_booster_redemption(uuid, jsonb);

create or replace function public.redeem_booster_code(input_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text;
  selected_code public.booster_codes%rowtype;
  redemption public.booster_code_redemptions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Connexion Discord requise.';
  end if;

  normalized_code := upper(regexp_replace(coalesce(input_code, ''), '\s+', '', 'g'));
  normalized_code := replace(replace(normalized_code, '–', '-'), '—', '-');

  if normalized_code = '' then
    raise exception 'Code booster manquant.';
  end if;

  select * into selected_code
  from public.booster_codes
  where code = normalized_code
  for update;

  if not found then
    raise exception 'Code booster invalide.';
  end if;

  if selected_code.status <> 'active' then
    raise exception 'Ce code booster est désactivé.';
  end if;

  if selected_code.expires_at is not null and selected_code.expires_at <= now() then
    raise exception 'Ce code booster a expiré.';
  end if;

  if selected_code.redeemed_count >= selected_code.max_redemptions then
    raise exception 'Ce code booster a déjà été utilisé.';
  end if;

  if exists (
    select 1 from public.booster_code_redemptions
    where code_id = selected_code.id
      and user_id = auth.uid()
      and status in ('pending', 'completed')
  ) then
    raise exception 'Tu as déjà utilisé ce code booster.';
  end if;

  insert into public.booster_code_redemptions (code_id, user_id, status, metadata)
  values (selected_code.id, auth.uid(), 'pending', jsonb_build_object('source', 'web', 'reserved_at', now()))
  returning * into redemption;

  update public.booster_codes
  set redeemed_count = redeemed_count + 1
  where id = selected_code.id;

  return jsonb_build_object(
    'redemption_id', redemption.id,
    'code_id', selected_code.id,
    'code', selected_code.code,
    'booster_type', selected_code.booster_type,
    'remaining_uses', greatest(0, selected_code.max_redemptions - selected_code.redeemed_count - 1)
  );
end;
$$;

create or replace function public.complete_booster_redemption(input_redemption_id uuid, input_cards jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cards_count integer;
begin
  if auth.uid() is null then
    raise exception 'Connexion Discord requise.';
  end if;

  if input_redemption_id is null then
    raise exception 'Redemption manquante.';
  end if;

  if not exists (
    select 1 from public.booster_code_redemptions
    where id = input_redemption_id
      and user_id = auth.uid()
      and status = 'pending'
  ) then
    raise exception 'Redemption invalide ou déjà complétée.';
  end if;

  if jsonb_typeof(input_cards) <> 'array' then
    raise exception 'Cartes invalides.';
  end if;

  select jsonb_array_length(input_cards) into cards_count;
  if cards_count <= 0 then
    raise exception 'Aucune carte à ajouter.';
  end if;

  insert into public.player_cards (user_id, card_id, rarity, family, metadata)
  select
    auth.uid(),
    coalesce(nullif(card.card_id, ''), nullif(card.id, ''), nullif(card.name, ''), 'unknown'),
    lower(coalesce(nullif(card.rarity, ''), 'common')),
    coalesce(nullif(card.family, ''), 'global'),
    jsonb_build_object(
      'name', card.name,
      'source', coalesce(card.source, 'booster'),
      'redemption_id', input_redemption_id,
      'rolled_at', now()
    )
  from jsonb_to_recordset(input_cards) as card(
    card_id text,
    id text,
    rarity text,
    family text,
    name text,
    source text
  )
  where coalesce(nullif(card.card_id, ''), nullif(card.id, ''), nullif(card.name, '')) is not null
    and lower(coalesce(nullif(card.rarity, ''), 'common')) in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'void');

  update public.booster_code_redemptions
  set status = 'completed',
      completed_at = now(),
      cards = input_cards,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('completed_via', 'complete_booster_redemption')
  where id = input_redemption_id;

  return jsonb_build_object('status', 'completed', 'redemption_id', input_redemption_id, 'cards_added', cards_count);
end;
$$;

-- =========================================================
-- Grants RPC
-- =========================================================
grant execute on function public.current_discord_id() to authenticated;
grant execute on function public.admin_current_identity_debug() to authenticated;
grant execute on function public.admin_is_current_user() to authenticated;
grant execute on function public.admin_is_discord_admin(text) to authenticated;
grant execute on function public.assert_discord_id_is_admin(text) to authenticated;
grant execute on function public.admin_generate_booster_codes_client(text, integer, text, timestamptz, integer, text) to authenticated;
grant execute on function public.admin_list_booster_codes(integer, text) to authenticated;
grant execute on function public.admin_list_booster_redemptions(integer) to authenticated;
grant execute on function public.redeem_booster_code(text) to authenticated;
grant execute on function public.complete_booster_redemption(uuid, jsonb) to authenticated;

-- =========================================================
-- À faire une fois après exécution : ajouter ton admin.
-- Remplace par ton Discord ID exact.
-- =========================================================
-- insert into public.admin_users (discord_id, label)
-- values ('1137457442414927973', 'Owner VOID Pack')
-- on conflict (discord_id) do update set label = excluded.label;

-- Debug optionnel après connexion côté site :
-- select public.admin_current_identity_debug();

-- =========================================================
-- Module 13 — Cartes custom / assets
-- =========================================================
create table if not exists public.custom_cards (
  id text primary key,
  name text not null,
  family text not null default 'global',
  rarity text not null default 'common',
  "character" text,
  image_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.custom_cards
  add column if not exists name text,
  add column if not exists family text not null default 'global',
  add column if not exists rarity text not null default 'common',
  add column if not exists "character" text,
  add column if not exists image_url text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists custom_cards_family_idx on public.custom_cards (family);
create index if not exists custom_cards_rarity_idx on public.custom_cards (rarity);

alter table public.custom_cards enable row level security;
drop policy if exists "Public can read custom cards" on public.custom_cards;
create policy "Public can read custom cards"
  on public.custom_cards
  for select
  to anon, authenticated
  using (true);

revoke all on public.custom_cards from anon, authenticated;
grant select on public.custom_cards to anon, authenticated;

drop function if exists public.list_custom_cards();
drop function if exists public.admin_upsert_custom_card_client(text, text, text, text, text, text, jsonb, text);
drop function if exists public.admin_delete_custom_card_client(text, text);

create or replace function public.list_custom_cards()
returns table (
  id text,
  name text,
  family text,
  rarity text,
  "character" text,
  image_url text,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.family, c.rarity, c."character", c.image_url, c.metadata, c.created_at, c.updated_at
  from public.custom_cards c
  order by c.family asc, c.rarity asc, c.name asc;
$$;

create or replace function public.admin_upsert_custom_card_client(
  input_card_id text,
  input_name text,
  input_family text,
  input_rarity text,
  input_character text default null,
  input_image_url text default null,
  input_metadata jsonb default '{}'::jsonb,
  input_admin_discord_id text default null
)
returns public.custom_cards
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  clean_id text := lower(regexp_replace(trim(input_card_id), '[^a-zA-Z0-9_-]+', '-', 'g'));
  saved public.custom_cards;
begin
  perform public.assert_discord_id_is_admin(input_admin_discord_id);

  if clean_id is null or clean_id = '' then
    raise exception 'ID carte requis.';
  end if;

  if trim(coalesce(input_name, '')) = '' then
    raise exception 'Nom carte requis.';
  end if;

  insert into public.custom_cards (id, name, family, rarity, "character", image_url, metadata, updated_at)
  values (
    clean_id,
    trim(input_name),
    lower(trim(coalesce(input_family, 'global'))),
    lower(trim(coalesce(input_rarity, 'common'))),
    nullif(trim(coalesce(input_character, '')), ''),
    nullif(trim(coalesce(input_image_url, '')), ''),
    coalesce(input_metadata, '{}'::jsonb),
    now()
  )
  on conflict (id) do update set
    name = excluded.name,
    family = excluded.family,
    rarity = excluded.rarity,
    "character" = excluded."character",
    image_url = excluded.image_url,
    metadata = excluded.metadata,
    updated_at = now()
  returning * into saved;

  return saved;
end;
$$;

create or replace function public.admin_delete_custom_card_client(
  input_card_id text,
  input_admin_discord_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.assert_discord_id_is_admin(input_admin_discord_id);

  delete from public.custom_cards
  where id = input_card_id;

  return jsonb_build_object('deleted', input_card_id);
end;
$$;

grant execute on function public.list_custom_cards() to anon, authenticated;
grant execute on function public.admin_upsert_custom_card_client(text, text, text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.admin_delete_custom_card_client(text, text) to authenticated;

-- =========================================================
-- Module 14.1 — RPC custom cards robuste (payload JSON unique)
-- Évite les erreurs PostgREST de signature quand les arguments nommés changent.
-- =========================================================
drop function if exists public.admin_save_custom_card_client(jsonb);

create or replace function public.admin_save_custom_card_client(input_payload jsonb)
returns public.custom_cards
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  clean_id text := lower(regexp_replace(trim(coalesce(input_payload ->> 'card_id', '')), '[^a-zA-Z0-9_-]+', '-', 'g'));
  saved public.custom_cards;
  admin_discord_id text := nullif(trim(coalesce(input_payload ->> 'admin_discord_id', '')), '');
  card_name text := trim(coalesce(input_payload ->> 'name', ''));
  card_family text := lower(trim(coalesce(input_payload ->> 'family', 'global')));
  card_rarity text := lower(trim(coalesce(input_payload ->> 'rarity', 'common')));
  card_character text := nullif(trim(coalesce(input_payload ->> 'character', '')), '');
  card_image_url text := nullif(trim(coalesce(input_payload ->> 'image_url', '')), '');
  card_metadata jsonb := coalesce(input_payload -> 'metadata', '{}'::jsonb);
begin
  perform public.assert_discord_id_is_admin(admin_discord_id);

  if clean_id is null or clean_id = '' then
    raise exception 'ID carte requis.';
  end if;

  if card_name = '' then
    raise exception 'Nom carte requis.';
  end if;

  if card_rarity not in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'void') then
    raise exception 'Rareté invalide.';
  end if;

  insert into public.custom_cards (id, name, family, rarity, "character", image_url, metadata, updated_at)
  values (
    clean_id,
    card_name,
    card_family,
    card_rarity,
    card_character,
    card_image_url,
    card_metadata,
    now()
  )
  on conflict (id) do update set
    name = excluded.name,
    family = excluded.family,
    rarity = excluded.rarity,
    "character" = excluded."character",
    image_url = excluded.image_url,
    metadata = excluded.metadata,
    updated_at = now()
  returning * into saved;

  return saved;
end;
$$;

grant execute on function public.admin_save_custom_card_client(jsonb) to authenticated;

-- Recharge le cache PostgREST après création/modification des RPC.
notify pgrst, 'reload schema';
