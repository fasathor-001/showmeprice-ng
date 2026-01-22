alter table public.escrow_orders
  add column if not exists amount bigint,
  add column if not exists currency text default 'NGN',
  add column if not exists status text default 'draft',
  add column if not exists paystack_reference text,
  add column if not exists paid_at timestamptz;
notify pgrst, 'reload schema';
