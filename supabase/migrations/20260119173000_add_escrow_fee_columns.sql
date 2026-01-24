alter table public.escrow_orders
  add column if not exists subtotal_kobo bigint not null default 0,
  add column if not exists escrow_fee_kobo bigint not null default 0,
  add column if not exists total_kobo bigint not null default 0,
  add column if not exists currency text not null default 'NGN';
notify pgrst, 'reload schema';
