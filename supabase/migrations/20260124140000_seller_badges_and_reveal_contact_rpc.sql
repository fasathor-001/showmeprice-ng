-- Canonical RPCs for seller badges and contact reveal (idempotent)
drop function if exists public.public_get_seller_badges(uuid[]);
drop function if exists public.reveal_seller_contact(uuid);

create or replace function public.public_get_seller_badges(ids uuid[])
returns table (
  id uuid,
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
    b.id as id,
    b.owner_id as owner_id,
    b.id as business_id,
    (lower(coalesce(to_jsonb(b)->>'verification_tier', to_jsonb(b)->>'verification', '')) = 'verified') as seller_is_verified,
    lower(coalesce(to_jsonb(b)->>'verification_tier', to_jsonb(b)->>'verification', '')) as seller_verification_tier,
    lower(nullif(coalesce(
      to_jsonb(b)->>'seller_membership_tier',
      to_jsonb(b)->>'membership_tier',
      to_jsonb(b)->>'plan'
    ), '')) as seller_membership_tier
  from public.businesses b
  where b.id = any(ids);
$$;

grant execute on function public.public_get_seller_badges(uuid[]) to anon, authenticated;

create or replace function public.reveal_seller_contact(business_id uuid)
returns table (whatsapp_number text, phone text)
language plpgsql
security definer
set search_path = public
as $$
declare
  plan text;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  select lower(coalesce(
    to_jsonb(p)->>'buyer_plan',
    to_jsonb(p)->>'plan',
    to_jsonb(p)->>'membership_tier',
    to_jsonb(p)->>'membership_1',
    'free'
  ))
    into plan
  from public.profiles p
  where p.id = auth.uid();

  if plan not in ('pro', 'premium', 'institution') then
    raise exception 'upgrade_required';
  end if;

  return query
  select
    coalesce(to_jsonb(b)->>'whatsapp_number', to_jsonb(b)->>'whatsapp', '') as whatsapp_number,
    coalesce(to_jsonb(b)->>'phone', to_jsonb(b)->>'phone_number', to_jsonb(b)->>'mobile', '') as phone
  from public.businesses b
  where b.id = business_id
  limit 1;
end;
$$;

grant execute on function public.reveal_seller_contact(uuid) to anon, authenticated;

create or replace function public.process_premium_upgrade(
  p_user_id uuid,
  p_reference text,
  p_amount numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  select id
    into v_business_id
  from public.businesses
  where owner_id = p_user_id or user_id = p_user_id
  limit 1;

  if v_business_id is null then
    raise exception 'No business profile found for this user';
  end if;

  if to_regclass('public.transactions') is not null then
    insert into public.transactions (user_id, reference, amount, status, plan_type)
    values (p_user_id, p_reference, p_amount, 'success', 'premium');
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='seller_membership_tier'
  ) then
    execute 'update public.businesses set seller_membership_tier = ''premium'' where id = $1'
      using v_business_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='membership_tier'
  ) then
    execute 'update public.businesses set membership_tier = ''premium'' where id = $1'
      using v_business_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='plan'
  ) then
    execute 'update public.businesses set plan = ''premium'' where id = $1'
      using v_business_id;
  end if;

  return true;
end;
$$;
