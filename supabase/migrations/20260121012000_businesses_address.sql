-- 20260121012000_businesses_address.sql
-- Add businesses.address for seller setup compatibility.

do $$
begin
  if to_regclass('public.businesses') is null then
    raise exception 'public.businesses does not exist';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='address'
  ) then
    alter table public.businesses add column address text;
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
