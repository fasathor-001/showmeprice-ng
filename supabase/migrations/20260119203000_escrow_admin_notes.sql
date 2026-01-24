alter table public.escrow_orders
  add column if not exists settlement_note text,
  add column if not exists dispute_resolution_note text;
notify pgrst, 'reload schema';
