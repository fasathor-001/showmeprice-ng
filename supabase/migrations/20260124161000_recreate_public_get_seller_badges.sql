-- 20260124161000_recreate_public_get_seller_badges.sql
-- Recreate seller badges RPC to avoid return-type conflicts.

drop function if exists public.public_get_seller_badges(uuid[]);

create function public.public_get_seller_badges(owner_ids uuid[])
returns table (
  owner_id uuid,
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
    b.owner_id,
    b.id as business_id,
    (lower(coalesce(to_jsonb(b)->>'verification_tier','')) = 'verified') as seller_is_verified,
    nullif(lower(coalesce(to_jsonb(b)->>'verification_tier','')), '') as seller_verification_tier,
    nullif(
      coalesce(
        lower(to_jsonb(b)->>'seller_membership_tier'),
        lower(to_jsonb(b)->>'seller_member'),
        lower(to_jsonb(b)->>'membership_tier'),
        lower(to_jsonb(b)->>'plan')
      ),
      ''
    ) as seller_membership_tier
  from public.businesses b
  where b.owner_id = any(owner_ids);
$$;

grant execute on function public.public_get_seller_badges(uuid[]) to anon, authenticated;
