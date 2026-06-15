-- Fix: max(jsonb) n'existe pas en Postgres — utilise array_agg à la place
create or replace function public.get_friend_collection(p_friend_id uuid)
returns table(card_id text, rarity text, family text, qty bigint, metadata jsonb)
language sql security definer as $$
  select pc.card_id, pc.rarity, pc.family, count(*) as qty, (array_agg(pc.metadata))[1] as metadata
  from public.player_cards pc
  where pc.user_id = p_friend_id
    and exists (
      select 1 from public.friendships f where f.status = 'accepted'
        and ((f.sender_id = auth.uid() and f.receiver_id = p_friend_id)
          or (f.receiver_id = auth.uid() and f.sender_id = p_friend_id))
    )
  group by pc.card_id, pc.rarity, pc.family;
$$;

grant execute on function public.get_friend_collection(uuid) to authenticated;
