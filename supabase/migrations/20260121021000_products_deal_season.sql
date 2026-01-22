-- Add deal_season to products for PostgREST compatibility

alter table public.products
  add column if not exists deal_season text;

select pg_notify('pgrst', 'reload schema');
