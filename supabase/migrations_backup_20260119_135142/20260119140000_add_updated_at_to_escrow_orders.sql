alter table public.escrow_orders
  add column if not exists updated_at timestamptz not null default now();

update public.escrow_orders
  set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

notify pgrst, 'reload schema';
