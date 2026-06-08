-- =========================================================
-- VOID Pack — Migration : suppression de la rareté "uncommon"
-- À exécuter UNE SEULE FOIS dans Supabase SQL Editor.
--
-- Ce que ça fait :
--   1. Migre les cartes "uncommon" existantes en "common"
--   2. Supprime l'ancien check constraint sur player_cards
--   3. Recrée le constraint sans "uncommon"
--   4. Met à jour le filtre dans complete_booster_redemption
-- =========================================================

-- 1. Migrer les éventuelles cartes "uncommon" en "common"
--    (sécurité : évite de perdre des données)
update public.player_cards
set rarity = 'common'
where rarity = 'uncommon';

-- 2. Supprimer l'ancien check constraint sur player_cards
--    (le nom du constraint est généré automatiquement par Postgres)
alter table public.player_cards
  drop constraint if exists player_cards_rarity_check;

-- 3. Recréer le constraint sans "uncommon"
alter table public.player_cards
  add constraint player_cards_rarity_check
  check (rarity in ('common', 'rare', 'epic', 'legendary', 'void'));

-- 4. Recréer complete_booster_redemption sans "uncommon" dans le filtre
--    (on recrée juste la fonction, pas toute la table)
create or replace function public.complete_booster_redemption(
  input_redemption_id uuid,
  input_cards jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cards_count integer;
begin
  if input_redemption_id is null then
    raise exception 'Redemption ID manquant.';
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
    -- Remapper "uncommon" → "common" pour compatibilité ascendante
    case
      when lower(coalesce(nullif(card.rarity, ''), 'common')) = 'uncommon' then 'common'
      else lower(coalesce(nullif(card.rarity, ''), 'common'))
    end,
    coalesce(nullif(card.family, ''), 'global'),
    jsonb_build_object(
      'name',           card.name,
      'source',         coalesce(card.source, 'booster'),
      'redemption_id',  input_redemption_id,
      'rolled_at',      now()
    )
  from jsonb_to_recordset(input_cards) as card(
    card_id text,
    id      text,
    rarity  text,
    family  text,
    name    text,
    source  text
  )
  where coalesce(nullif(card.card_id, ''), nullif(card.id, ''), nullif(card.name, '')) is not null
    and lower(coalesce(nullif(card.rarity, ''), 'common'))
        in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'void');

  update public.booster_code_redemptions
  set status       = 'completed',
      completed_at = now(),
      cards        = input_cards,
      metadata     = coalesce(metadata, '{}'::jsonb)
                     || jsonb_build_object('completed_via', 'complete_booster_redemption')
  where id = input_redemption_id;

  return jsonb_build_object(
    'status',        'completed',
    'redemption_id', input_redemption_id,
    'cards_added',   cards_count
  );
end;
$$;

grant execute on function public.complete_booster_redemption(uuid, jsonb) to authenticated;
