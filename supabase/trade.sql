-- ═══════════════════════════════════════════════════════════════════════
-- VOID Pack — Système de trade entre joueurs
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Offres de trade
create table if not exists public.trade_offers (
  id              uuid primary key default gen_random_uuid(),
  sender_id       uuid not null references auth.users(id) on delete cascade,
  receiver_id     uuid not null references auth.users(id) on delete cascade,
  -- Carte proposée (du sender)
  offered_card_id    uuid not null references public.player_cards(id) on delete cascade,
  offered_card_key   text not null,  -- card_id lisible
  offered_rarity     text not null,
  -- Carte demandée (du receiver)
  wanted_card_key    text not null,  -- card_id demandé
  wanted_rarity      text,
  wanted_card_name   text,           -- nom affiché
  -- Statut
  status          text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  message         text,              -- message optionnel du sender
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '48 hours',
  responded_at    timestamptz
);

create index if not exists idx_trade_receiver on public.trade_offers(receiver_id, status);
create index if not exists idx_trade_sender   on public.trade_offers(sender_id,   status);

-- 2. RLS
alter table public.trade_offers enable row level security;

create policy "see own trades" on public.trade_offers
  for select using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "send trade" on public.trade_offers
  for insert with check (sender_id = auth.uid());

create policy "update own trades" on public.trade_offers
  for update using (sender_id = auth.uid() or receiver_id = auth.uid());

-- 3. Realtime
alter publication supabase_realtime add table public.trade_offers;

-- 4. RPC : accepter un trade (échange atomique des cartes)
create or replace function public.accept_trade(p_trade_id uuid)
returns jsonb
language plpgsql security definer
as $$
declare
  v_trade      public.trade_offers;
  v_wanted_id  uuid;
begin
  -- Charger l'offre
  select * into v_trade
  from public.trade_offers
  where id = p_trade_id
    and receiver_id = auth.uid()
    and status = 'pending'
    and expires_at > now();

  if not found then
    return jsonb_build_object('error', 'trade_not_found_or_expired');
  end if;

  -- Trouver la carte demandée dans la collection du receiver
  select id into v_wanted_id
  from public.player_cards
  where user_id = auth.uid()
    and card_id  = v_trade.wanted_card_key
  limit 1;

  if not found then
    return jsonb_build_object('error', 'wanted_card_not_in_collection');
  end if;

  -- Vérifier que la carte offerte existe toujours chez le sender
  if not exists (
    select 1 from public.player_cards
    where id = v_trade.offered_card_id
      and user_id = v_trade.sender_id
  ) then
    return jsonb_build_object('error', 'offered_card_no_longer_available');
  end if;

  -- Échange atomique : transférer les cartes
  update public.player_cards
  set user_id = auth.uid()
  where id = v_trade.offered_card_id;

  update public.player_cards
  set user_id = v_trade.sender_id
  where id = v_wanted_id;

  -- Marquer le trade comme accepté
  update public.trade_offers
  set status = 'accepted', responded_at = now()
  where id = p_trade_id;

  -- Annuler les autres offres en attente impliquant ces cartes
  update public.trade_offers
  set status = 'cancelled'
  where id != p_trade_id
    and status = 'pending'
    and (
      offered_card_id = v_trade.offered_card_id
      or offered_card_id = v_wanted_id
    );

  return jsonb_build_object('ok', true);
end;
$$;

-- 5. RPC : refuser un trade
create or replace function public.decline_trade(p_trade_id uuid)
returns void
language plpgsql security definer
as $$
begin
  update public.trade_offers
  set status = 'declined', responded_at = now()
  where id = p_trade_id
    and receiver_id = auth.uid()
    and status = 'pending';
end;
$$;

-- 6. RPC : annuler un trade (par le sender)
create or replace function public.cancel_trade(p_trade_id uuid)
returns void
language plpgsql security definer
as $$
begin
  update public.trade_offers
  set status = 'cancelled'
  where id = p_trade_id
    and sender_id = auth.uid()
    and status = 'pending';
end;
$$;

-- 7. RPC : trades en attente pour le joueur connecté
create or replace function public.get_pending_trades()
returns table (
  id                uuid,
  direction         text,
  other_user_id     uuid,
  other_username    text,
  other_avatar_url  text,
  offered_card_key  text,
  offered_rarity    text,
  wanted_card_key   text,
  wanted_card_name  text,
  wanted_rarity     text,
  message           text,
  created_at        timestamptz,
  expires_at        timestamptz
)
language sql security definer
as $$
  select
    t.id,
    case when t.sender_id = auth.uid() then 'sent' else 'received' end as direction,
    case when t.sender_id = auth.uid() then t.receiver_id else t.sender_id end as other_user_id,
    pp.username,
    pp.avatar_url,
    t.offered_card_key,
    t.offered_rarity,
    t.wanted_card_key,
    t.wanted_card_name,
    t.wanted_rarity,
    t.message,
    t.created_at,
    t.expires_at
  from public.trade_offers t
  join public.player_profiles pp
    on pp.user_id = case when t.sender_id = auth.uid() then t.receiver_id else t.sender_id end
  where (t.sender_id = auth.uid() or t.receiver_id = auth.uid())
    and t.status = 'pending'
    and t.expires_at > now()
  order by t.created_at desc;
$$;

-- 8. RPC : collection d'un ami (pour choisir une carte à demander)
create or replace function public.get_friend_collection(p_friend_id uuid)
returns table (
  card_id   text,
  rarity    text,
  family    text,
  qty       bigint,
  metadata  jsonb
)
language sql security definer
as $$
  -- Vérifier l'amitié
  select pc.card_id, pc.rarity, pc.family, count(*) as qty, max(pc.metadata) as metadata
  from public.player_cards pc
  where pc.user_id = p_friend_id
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.sender_id = auth.uid() and f.receiver_id = p_friend_id)
          or (f.receiver_id = auth.uid() and f.sender_id = p_friend_id)
        )
    )
  group by pc.card_id, pc.rarity, pc.family;
$$;
