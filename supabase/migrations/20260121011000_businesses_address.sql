-- 20260121011000_businesses_address.sql
-- Add address to businesses for seller setup compatibility + reload PostgREST schema

do $$
begin
  if to_regclass('public.businesses') is null then
    raise exception 'public.businesses does not exist';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='businesses'
      and column_name='address'
  ) then
    alter table public.businesses add column address text;
  end if;

  -- Optional backfill from profiles.address (safe if you already store it there)
  begin
    update public.businesses b
      set address = p.address
    from public.profiles p
    where b.address is null
      and p.address is not null
      and b.user_id = p.id;
  exception when undefined_column then
    null;
  end;

  perform pg_notify('pgrst','reload schema');
end $$;