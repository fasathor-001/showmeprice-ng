-- Public RPC to expose seller badge fields for buyer views (business_id or owner_id)
create or replace function public.public_get_seller_badges(ids uuid[])
returns table (
  key uuid,
  seller_is_verified boolean,
  seller_verification_tier text,
  seller_membership_tier text
)
language sql
security definer
set search_path = public
as $$
  select
    b.id as key,
    (lower(coalesce(b.verification_tier, '')) = 'verified') as seller_is_verified,
    b.verification_tier as seller_verification_tier,
    coalesce(p.membership_tier, p.membership_1, 'free') as seller_membership_tier
  from public.businesses b
  left join public.profiles p on p.id = b.owner_id
  where b.id = any(ids)

  union all

  select
    b.owner_id as key,
    (lower(coalesce(b.verification_tier, '')) = 'verified') as seller_is_verified,
    b.verification_tier as seller_verification_tier,
    coalesce(p.membership_tier, p.membership_1, 'free') as seller_membership_tier
  from public.businesses b
  left join public.profiles p on p.id = b.owner_id
  where b.owner_id = any(ids);
$$;

grant execute on function public.public_get_seller_badges(uuid[]) to anon, authenticated;
