-- Ensure offers table has expected amount columns (kobo)
alter table public.offers
  add column if not exists offer_amount_kobo bigint;

alter table public.offers
  add column if not exists accepted_amount_kobo bigint;

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';
notify pgrst, 'reload config';
