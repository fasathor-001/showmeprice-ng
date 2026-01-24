-- 20260121015000_businesses_profile_fields_compat.sql
-- Add missing seller-business fields for UI compatibility + PostgREST reload

do $$
begin
  if to_regclass('public.businesses') is null then
    raise exception 'public.businesses does not exist';
  end if;

  -- Contact + profile fields
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='whatsapp_number'
  ) then
    alter table public.businesses add column whatsapp_number text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='phone_number'
  ) then
    alter table public.businesses add column phone_number text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='description'
  ) then
    alter table public.businesses add column description text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='links'
  ) then
    alter table public.businesses add column links jsonb default '[]'::jsonb;
  end if;

  -- Timestamps (safe)
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='created_at'
  ) then
    alter table public.businesses add column created_at timestamptz default now();
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='updated_at'
  ) then
    alter table public.businesses add column updated_at timestamptz default now();
  end if;

  -- Ensure upsert can use ON CONFLICT (user_id must be unique)
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='user_id'
  ) then
    create unique index if not exists businesses_user_id_key on public.businesses(user_id);
  end if;

  perform pg_notify('pgrst','reload schema');
end $$;
