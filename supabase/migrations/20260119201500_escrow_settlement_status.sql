alter table public.escrow_orders
  add column if not exists settlement_status text not null default 'holding',
  add column if not exists settlement_amount_kobo bigint,
  add column if not exists platform_fee_kobo bigint,
  add column if not exists settlement_currency text not null default 'NGN',
  add column if not exists settlement_admin_id uuid,
  add column if not exists settlement_note text;

update public.escrow_orders
set settlement_amount_kobo = coalesce(settlement_amount_kobo, subtotal_kobo),
    platform_fee_kobo      = coalesce(platform_fee_kobo, escrow_fee_kobo)
where (settlement_amount_kobo is null or platform_fee_kobo is null)
  and coalesce(subtotal_kobo, 0) > 0;

notify pgrst, 'reload schema';
