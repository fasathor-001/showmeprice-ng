-- Public RPC to expose seller verification badge to buyers
create or replace function public.public_get_seller_badges(owner_ids uuid[])
returns table (
  owner_id uuid,
  seller_is_verified boolean,
  seller_verification_tier text
)
language sql
security definer
set search_path = public
as $$
  select
    b.owner_id,
    (lower(coalesce(b.verification_tier, '')) = 'verified') as seller_is_verified,
    b.verification_tier as seller_verification_tier
  from public.businesses b
  where b.owner_id = any(owner_ids);
$$;
grant execute on function public.public_get_seller_badges(uuid[]) to anon, authenticated;
