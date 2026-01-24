-- 20260121014000_businesses_description.sql
-- Add description to businesses for seller setup compatibility + reload PostgREST schema

do $$
begin
  if to_regclass('public.businesses') is null then
    raise exception 'public.businesses does not exist';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='businesses'
      and column_name='description'
  ) then
    alter table public.businesses add column description text;
  end if;

  perform pg_notify('pgrst','reload schema');
end $$;
