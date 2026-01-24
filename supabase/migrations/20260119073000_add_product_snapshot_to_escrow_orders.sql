alter table public.escrow_orders
  add column if not exists product_snapshot jsonb;
notify pgrst, 'reload schema';
