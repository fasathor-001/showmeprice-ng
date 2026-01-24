-- 20260121013000_businesses_phone_number.sql
-- Add phone_number to businesses for seller setup compatibility + reload PostgREST schema

do $$
begin
  if to_regclass('public.businesses') is null then
    raise exception 'public.businesses does not exist';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='businesses'
      and column_name='phone_number'
  ) then
    alter table public.businesses add column phone_number text;
  end if;

  -- Optional backfill from profiles.phone
  begin
    update public.businesses b
      set phone_number = p.phone
    from public.profiles p
    where b.phone_number is null
      and p.phone is not null
      and b.user_id = p.id;
  exception when undefined_column then
    null;
  end;

  perform pg_notify('pgrst','reload schema');
end $$;
