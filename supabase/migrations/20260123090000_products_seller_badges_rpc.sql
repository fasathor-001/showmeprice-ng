-- Public RPC for seller badge lookups without exposing business contact fields.
create or replace function public.public_get_seller_badges(owner_ids uuid[])
returns table(owner_id uuid, verification_tier text, is_verified boolean)
language sql
security definer
set search_path = public
as $$
  select
    b.owner_id,
    b.verification_tier,
    lower(coalesce(b.verification_tier, '')) = 'verified' as is_verified
  from public.businesses b
  where b.owner_id = any(owner_ids);
$$;

grant execute on function public.public_get_seller_badges(uuid[]) to anon, authenticated;
