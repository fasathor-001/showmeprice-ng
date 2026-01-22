alter table public.escrow_orders
  add column if not exists delivery_status text not null default 'pending',
  add column if not exists delivered_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists dispute_status text not null default 'none',
  add column if not exists dispute_reason text,
  add column if not exists dispute_opened_at timestamptz,
  add column if not exists dispute_resolved_at timestamptz,
  add column if not exists resolution text,
  add column if not exists released_at timestamptz;

create index if not exists escrow_orders_buyer_created_idx
  on public.escrow_orders (buyer_id, created_at desc);
create index if not exists escrow_orders_seller_created_idx
  on public.escrow_orders (seller_id, created_at desc);
create index if not exists escrow_orders_status_dispute_idx
  on public.escrow_orders (status, dispute_status);

notify pgrst, 'reload schema';
