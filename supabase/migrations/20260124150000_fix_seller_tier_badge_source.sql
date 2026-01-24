-- Fix seller tier badge source and RPC return type
alter table public.businesses
  add column if not exists seller_membership_tier text;

drop function if exists public.public_get_seller_badges(uuid[]) cascade;

create or replace function public.public_get_seller_badges(ids uuid[])
returns table (
  business_id uuid,
  owner_id uuid,
  seller_is_verified boolean,
  seller_verification_tier text,
  seller_membership_tier text
)
language sql
security definer
set search_path = public
as $$
  select
    b.id as business_id,
    b.owner_id,
    (lower(coalesce(to_jsonb(b)->>'verification_tier', '')) = 'verified') as seller_is_verified,
    lower(coalesce(to_jsonb(b)->>'verification_tier', '')) as seller_verification_tier,
    lower(nullif(coalesce(
      to_jsonb(b)->>'seller_membership_tier',
      to_jsonb(b)->>'membership_tier',
      to_jsonb(b)->>'plan'
    ), '')) as seller_membership_tier
  from public.businesses b
  where b.id = any(ids);
$$;

grant execute on function public.public_get_seller_badges(uuid[]) to anon, authenticated;
