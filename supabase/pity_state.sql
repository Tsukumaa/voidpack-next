-- =========================================================
-- VOID Pack — Pity System
-- Migration : table player_pity_state
--
-- Logique :
--   packsSinceLegendary : reset sur pull Legendary ou Void
--   packsSinceVoid      : reset UNIQUEMENT sur pull Void
--                         (pull Legendary ne reset PAS ce compteur)
--
-- Garanties :
--   Legendary garanti après 50 packs sans Legendary+
--   Void garanti après 500 packs sans Void
-- =========================================================

create table if not exists public.player_pity_state (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  packs_since_legendary integer not null default 0 check (packs_since_legendary >= 0),
  packs_since_void      integer not null default 0 check (packs_since_void >= 0),
  total_packs_opened    integer not null default 0 check (total_packs_opened >= 0),
  last_legendary_at     timestamptz,
  last_void_at          timestamptz,
  updated_at            timestamptz not null default now()
);

alter table public.player_pity_state enable row level security;

-- Le joueur peut lire son propre pity state
drop policy if exists "Players can read own pity state" on public.player_pity_state;
create policy "Players can read own pity state"
  on public.player_pity_state
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Pas d'écriture directe côté client — tout passe par RPC security definer
revoke insert, update, delete on public.player_pity_state from anon, authenticated;

create index if not exists player_pity_state_user_idx on public.player_pity_state (user_id);

-- =========================================================
-- RPC : get_or_create_pity_state
-- Retourne l'état pity actuel, crée une ligne si absente.
-- =========================================================

create or replace function public.get_or_create_pity_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_state   public.player_pity_state%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentification requise.';
  end if;

  insert into public.player_pity_state (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select * into v_state
  from public.player_pity_state
  where user_id = v_user_id;

  return jsonb_build_object(
    'packsSinceLegendary', v_state.packs_since_legendary,
    'packsSinceVoid',      v_state.packs_since_void,
    'totalPacksOpened',    v_state.total_packs_opened,
    'lastLegendaryAt',     v_state.last_legendary_at,
    'lastVoidAt',          v_state.last_void_at
  );
end;
$$;

-- =========================================================
-- RPC : update_pity_after_pack
-- Appelé par complete_booster_redemption après chaque opening.
-- Reçoit les rarités pullées dans le pack.
--
-- Paramètres :
--   input_cards : jsonb array de { rarity: 'common'|'rare'|... }
-- =========================================================

create or replace function public.update_pity_after_pack(input_cards jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id              uuid := auth.uid();
  v_has_legendary        boolean;
  v_has_void             boolean;
  v_state                public.player_pity_state%rowtype;
  v_new_since_legendary  integer;
  v_new_since_void       integer;
begin
  if v_user_id is null then
    raise exception 'Authentification requise.';
  end if;

  -- Détecter les rarités dans le pack
  v_has_void      := exists (
    select 1 from jsonb_array_elements(input_cards) as c
    where c->>'rarity' = 'void'
  );

  v_has_legendary := v_has_void or exists (
    select 1 from jsonb_array_elements(input_cards) as c
    where c->>'rarity' = 'legendary'
  );

  -- Créer la ligne si absente
  insert into public.player_pity_state (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select * into v_state
  from public.player_pity_state
  where user_id = v_user_id;

  -- Calculer les nouveaux compteurs
  v_new_since_legendary := case when v_has_legendary then 0
                                else v_state.packs_since_legendary + 1 end;

  -- Void pity : reset UNIQUEMENT sur pull Void (pas sur Legendary seul)
  v_new_since_void := case when v_has_void then 0
                           else v_state.packs_since_void + 1 end;

  -- Mettre à jour
  update public.player_pity_state set
    packs_since_legendary = v_new_since_legendary,
    packs_since_void      = v_new_since_void,
    total_packs_opened    = v_state.total_packs_opened + 1,
    last_legendary_at     = case when v_has_legendary then now()
                                 else v_state.last_legendary_at end,
    last_void_at          = case when v_has_void then now()
                                 else v_state.last_void_at end,
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

-- Accès RPC uniquement pour les utilisateurs authentifiés
grant execute on function public.get_or_create_pity_state() to authenticated;
grant execute on function public.update_pity_after_pack(jsonb) to authenticated;
