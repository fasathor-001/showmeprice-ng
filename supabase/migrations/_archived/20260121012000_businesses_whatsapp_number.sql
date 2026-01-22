-- 20260121012000_businesses_whatsapp_number.sql
-- Add whatsapp_number to businesses for seller setup compatibility + reload PostgREST schema

do $$
begin
  if to_regclass('public.businesses') is null then
    raise exception 'public.businesses does not exist';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='businesses'
      and column_name='whatsapp_number'
  ) then
    alter table public.businesses add column whatsapp_number text;
  end if;

  -- Optional backfill from profiles.phone (or profiles.whatsapp_number if it exists)
  begin
    update public.businesses b
      set whatsapp_number = coalesce(p.whatsapp_number, p.phone)
    from public.profiles p
    where b.whatsapp_number is null
      and b.user_id = p.id;
  exception when undefined_column then
    -- if profiles.whatsapp_number doesn't exist, fall back to phone only
    begin
      update public.businesses b
        set whatsapp_number = p.phone
      from public.profiles p
      where b.whatsapp_number is null
        and p.phone is not null
        and b.user_id = p.id;
    exception when undefined_column then
      null;
    end;
  end;

  perform pg_notify('pgrst','reload schema');
end $$;