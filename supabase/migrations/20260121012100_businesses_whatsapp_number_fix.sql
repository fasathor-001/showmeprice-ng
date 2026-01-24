-- 20260121012100_businesses_whatsapp_number_fix.sql
do $$
begin
  if to_regclass('public.businesses') is null then
    raise exception 'public.businesses does not exist';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='whatsapp_number'
  ) then
    alter table public.businesses add column whatsapp_number text;
  end if;

  perform pg_notify('pgrst','reload schema');
end $$;
