alter table public.escrow_orders
  add column if not exists dispute_status text not null default 'none',
  add column if not exists dispute_reason text,
  add column if not exists dispute_opened_at timestamptz,
  add column if not exists dispute_resolved_at timestamptz,
  add column if not exists resolution text,
  add column if not exists released_at timestamptz,
  add column if not exists refunded_at timestamptz;
notify pgrst, 'reload schema';
