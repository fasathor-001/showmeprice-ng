-- Align schema with current UI queries (safe, idempotent)

alter table public.categories
  add column if not exists sort_order integer not null default 0;

alter table public.profiles
  add column if not exists membership_tier text not null default 'free',
  add column if not exists address text null,
  add column if not exists state_id integer null,
  add column if not exists city text null,
  add column if not exists phone text null;

alter table public.feature_flags
  add column if not exists visible_to text null,
  add column if not exists updated_at timestamptz null;

alter table public.businesses
  add column if not exists user_id uuid null,
  add column if not exists business_name text null,
  add column if not exists verification_tier text null,
  add column if not exists verification_status text null;

select pg_notify('pgrst', 'reload schema');
