do $$
begin
  alter table public.escrow_orders
    add constraint escrow_min_amount_guardrail
    check (subtotal_kobo >= 5000000)
    not valid;
exception
  when duplicate_object then
    null;
end $$;
notify pgrst, 'reload schema';
