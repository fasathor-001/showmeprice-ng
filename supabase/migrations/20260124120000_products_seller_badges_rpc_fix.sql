-- Public RPC to expose seller badge fields by business_id
create or replace function public.public_get_seller_badges(ids uuid[])
returns table (
  id uuid,
  business_id uuid,
  seller_is_verified boolean,
  seller_verification_tier text,
  seller_membership_tier text
)
language sql
security definer
set search_path = public
as $$
  select
    b.id as id,
    b.id as business_id,
    (lower(coalesce(b.verification_tier, '')) = 'verified') as seller_is_verified,
    b.verification_tier as seller_verification_tier,
    p.membership_tier as seller_membership_tier
  from public.businesses b
  left join public.profiles p on p.id = b.owner_id
  where b.id = any(ids);
$$;
grant execute on function public.public_get_seller_badges(uuid[]) to anon, authenticated;
