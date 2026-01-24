-- 20260121023000_products_deal_season.sql
-- Add deal_season to products (Deals compatibility) + reload PostgREST schema

do $$
begin
  if to_regclass('public.products') is null then
    raise exception 'public.products does not exist';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='products'
      and column_name='deal_season'
  ) then
    alter table public.products add column deal_season text;
  end if;

  perform pg_notify('pgrst','reload schema');
end $$;
