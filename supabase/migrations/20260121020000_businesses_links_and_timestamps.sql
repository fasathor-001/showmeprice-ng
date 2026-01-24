-- 20260121020000_businesses_links_and_timestamps.sql
-- Add businesses.links + updated_at support for MyShopPage selects

do $$
begin
  if to_regclass('public.businesses') is null then
    raise exception 'public.businesses does not exist';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='links'
  ) then
    alter table public.businesses add column links jsonb not null default '{}'::jsonb;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='updated_at'
  ) then
    alter table public.businesses add column updated_at timestamptz not null default now();
  end if;

  perform pg_notify('pgrst','reload schema');
end $$;
