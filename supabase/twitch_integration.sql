-- ═══════════════════════════════════════════════════════════════════════════════
-- VOID Pack — Intégration Twitch multi-streamer
-- Chaque streamer a ses propres boosters exclusifs et son propre chat d'annonce.
-- À exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Colonnes Twitch sur player_profiles ────────────────────────────────────
alter table public.player_profiles
  add column if not exists twitch_id    text unique,
  add column if not exists twitch_login text;

-- ── 2. Table des streamers partenaires ───────────────────────────────────────
-- Un streamer = une chaîne Twitch avec ses propres boosters et son bot configuré.
create table if not exists public.twitch_streamers (
  id                    serial primary key,
  broadcaster_id        text not null unique,   -- ID Twitch du streamer (numérique)
  broadcaster_login     text not null,          -- Login Twitch du streamer (ex: "streamer_abc")
  broadcaster_name      text,                   -- Nom affiché
  bot_access_token      text,                   -- Token OAuth du bot pour CE chat (chiffré idéalement)
  bot_refresh_token     text,                   -- Refresh token pour renouveler
  eventsub_secret       text not null,          -- Secret HMAC propre à ce streamer
  active                boolean not null default true,
  created_at            timestamptz not null default now()
);

-- ── 3. Table des récompenses Channel Points ───────────────────────────────────
-- Chaque récompense est liée à UN streamer et UN type de booster.
create table if not exists public.twitch_rewards (
  id                    serial primary key,
  broadcaster_id        text not null references public.twitch_streamers(broadcaster_id) on delete cascade,
  reward_id             text not null unique,   -- ID de la récompense Twitch
  booster_type          text not null,          -- Type de booster exclusif à ce streamer
  reward_label          text,                   -- Ex: "🎴 Pack StreamerABC"
  points_cost           int,
  active                boolean not null default true,
  created_at            timestamptz not null default now()
);

-- Index pour lookup rapide par reward_id (le plus fréquent dans les webhooks)
create index if not exists idx_twitch_rewards_reward_id on public.twitch_rewards(reward_id);
create index if not exists idx_twitch_rewards_broadcaster on public.twitch_rewards(broadcaster_id);

-- ── 4. Log des événements EventSub ───────────────────────────────────────────
create table if not exists public.twitch_eventsub_log (
  id                    bigserial primary key,
  broadcaster_id        text,                   -- Chaîne sur laquelle l'événement s'est passé
  broadcaster_login     text,
  twitch_user_id        text,
  twitch_login          text,
  reward_id             text,
  redemption_id         text unique,
  status                text not null default 'pending',
  code_generated        text,
  error_message         text,
  created_at            timestamptz not null default now()
);

-- ── 5. Log des pulls rares ────────────────────────────────────────────────────
-- On mémorise depuis quelle chaîne streamer le booster a été obtenu,
-- pour annoncer dans le bon chat.
create table if not exists public.twitch_rare_pull_log (
  id                    bigserial primary key,
  user_id               uuid references auth.users(id),
  twitch_login          text,                   -- Login Twitch du joueur
  broadcaster_id        text,                   -- Chaîne qui a distribué le booster
  broadcaster_login     text,
  card_name             text,
  rarity                text,
  announced_at          timestamptz not null default now()
);

-- ── 6. Lier un booster_code_redemption à un broadcaster ──────────────────────
-- Quand un code Twitch est généré, on mémorise le broadcaster source
-- pour savoir dans quel chat annoncer le pull rare plus tard.
alter table public.booster_codes
  add column if not exists twitch_broadcaster_id text;

-- ── 7. RPC : lier/délier un compte Twitch joueur ─────────────────────────────
create or replace function public.link_twitch_account(
  p_twitch_id    text,
  p_twitch_login text
) returns void language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  update public.player_profiles
  set twitch_id = p_twitch_id, twitch_login = p_twitch_login
  where user_id = auth.uid();
end;
$$;

create or replace function public.unlink_twitch_account()
returns void language plpgsql security definer as $$
begin
  update public.player_profiles
  set twitch_id = null, twitch_login = null
  where user_id = auth.uid();
end;
$$;

-- ── 8. RPC : générer un code booster (multi-streamer) ────────────────────────
-- Appelée par l'Edge Function après vérification du webhook.
-- Retourne aussi le broadcaster_login pour que l'Edge Function sache
-- dans quel chat envoyer le message.
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

  -- Récupérer la récompense ET vérifier qu'elle appartient bien à ce broadcaster
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

  -- Retrouver le joueur VOID Pack
  select user_id into v_user_id
  from public.player_profiles
  where twitch_id = p_twitch_user_id;

  if not found then
    insert into public.twitch_eventsub_log
      (broadcaster_id, broadcaster_login, twitch_user_id, twitch_login,
       reward_id, redemption_id, status, error_message)
    values
      (p_broadcaster_id, p_broadcaster_login, p_twitch_user_id, p_twitch_login,
       p_reward_id, p_redemption_id, 'unknown_user', 'twitch_account_not_linked');
    return query select null::text, null::text, p_broadcaster_login, 'twitch_account_not_linked'::text;
    return;
  end if;

  -- Générer le code (format: STR-XXXX-XXXX, préfixe = 3 premières lettres du broadcaster)
  v_code := upper(left(p_broadcaster_login, 3)) || '-' ||
    upper(substr(md5(random()::text), 1, 4)) || '-' ||
    upper(substr(md5(p_redemption_id), 1, 4));

  -- Insérer le code avec la référence au broadcaster
  insert into public.booster_codes
    (code, booster_type, created_by, max_redemptions, active, twitch_broadcaster_id)
  values
    (v_code, v_reward.booster_type, v_user_id, 1, true, p_broadcaster_id);

  -- Logger
  insert into public.twitch_eventsub_log
    (broadcaster_id, broadcaster_login, twitch_user_id, twitch_login,
     reward_id, redemption_id, status, code_generated)
  values
    (p_broadcaster_id, p_broadcaster_login, p_twitch_user_id, p_twitch_login,
     p_reward_id, p_redemption_id, 'processed', v_code);

  return query select v_code, v_reward.booster_type, p_broadcaster_login, null::text;
end;
$$;

-- ── 9. RPC : retrouver le broadcaster source d'une redemption ────────────────
-- Appelée post-pull pour savoir dans quel chat annoncer.
create or replace function public.get_broadcaster_for_code(p_code text)
returns table (
  broadcaster_id    text,
  broadcaster_login text,
  bot_access_token  text
)
language sql security definer
as $$
  select s.broadcaster_id, s.broadcaster_login, s.bot_access_token
  from public.booster_codes bc
  join public.twitch_streamers s on s.broadcaster_id = bc.twitch_broadcaster_id
  where bc.code = p_code
    and s.active = true
  limit 1;
$$;

-- ── 10. RPC : logguer un pull rare ───────────────────────────────────────────
create or replace function public.log_rare_pull_for_twitch(
  p_card_name       text,
  p_rarity          text,
  p_broadcaster_id  text,
  p_broadcaster_login text
) returns void language plpgsql security definer as $$
declare
  v_uid        uuid := auth.uid();
  v_twitch_login text;
begin
  if v_uid is null then return; end if;
  select twitch_login into v_twitch_login
  from public.player_profiles where user_id = v_uid;
  if v_twitch_login is null then return; end if;

  insert into public.twitch_rare_pull_log
    (user_id, twitch_login, broadcaster_id, broadcaster_login, card_name, rarity)
  values
    (v_uid, v_twitch_login, p_broadcaster_id, p_broadcaster_login, p_card_name, p_rarity);
end;
$$;

-- ── 11. RLS ───────────────────────────────────────────────────────────────────
alter table public.twitch_streamers      enable row level security;
alter table public.twitch_rewards        enable row level security;
alter table public.twitch_eventsub_log   enable row level security;
alter table public.twitch_rare_pull_log  enable row level security;

create policy "service only" on public.twitch_streamers
  using (auth.role() = 'service_role');
create policy "service only" on public.twitch_rewards
  using (auth.role() = 'service_role');
create policy "service only" on public.twitch_eventsub_log
  using (auth.role() = 'service_role');
create policy "service only" on public.twitch_rare_pull_log
  using (auth.role() = 'service_role');

-- ── 12. Vue admin pratique ────────────────────────────────────────────────────
create or replace view public.twitch_streamers_overview as
select
  s.broadcaster_login,
  s.broadcaster_name,
  s.broadcaster_id,
  s.active,
  count(distinct r.id)                              as rewards_count,
  count(distinct l.id) filter (where l.status = 'processed') as codes_generated,
  count(distinct l.id) filter (where l.status = 'unknown_user') as unlinked_viewers
from public.twitch_streamers s
left join public.twitch_rewards r       on r.broadcaster_id = s.broadcaster_id
left join public.twitch_eventsub_log l  on l.broadcaster_id = s.broadcaster_id
group by s.id, s.broadcaster_login, s.broadcaster_name, s.broadcaster_id, s.active;
