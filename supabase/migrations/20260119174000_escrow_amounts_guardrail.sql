alter table public.escrow_orders
  add constraint escrow_amounts_positive
  check (total_kobo > 0 and subtotal_kobo > 0)
  not valid;

notify pgrst, 'reload schema';
