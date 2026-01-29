alter table public.offers
  add column if not exists offer_amount_kobo bigint,
  add column if not exists accepted_amount_kobo bigint;

notify pgrst, 'reload schema';
notify pgrst, 'reload config';
