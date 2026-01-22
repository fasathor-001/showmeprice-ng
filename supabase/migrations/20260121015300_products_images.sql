-- 20260121015300_products_images.sql
-- Add images to products for UI compatibility + PostgREST reload

do $$
begin
  if to_regclass('public.products') is null then
    raise exception 'public.products does not exist';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='images'
  ) then
    alter table public.products add column images jsonb default '[]'::jsonb;
  end if;

  perform pg_notify('pgrst','reload schema');
end $$;