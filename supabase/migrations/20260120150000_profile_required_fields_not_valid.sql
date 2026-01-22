-- Require core profile fields for new/updated rows (non-breaking for existing data)

alter table public.profiles
  add column if not exists phone text,
  add column if not exists city text,
  add column if not exists address text,
  add column if not exists business_name text;

alter table public.profiles
  add constraint profiles_full_name_required
  check (
    full_name is not null
    and btrim(full_name) <> ''
    and not (full_name ~* '^(user|buyer|seller)\\s+[0-9a-f]{4,}$')
  )
  not valid;

alter table public.profiles
  add constraint profiles_phone_required
  check (phone is not null and btrim(phone) <> '')
  not valid;

alter table public.profiles
  add constraint profiles_city_required
  check (city is not null and btrim(city) <> '')
  not valid;

alter table public.profiles
  add constraint profiles_seller_business_required
  check (
    coalesce(user_type, '') <> 'seller'
    or (
      business_name is not null
      and btrim(business_name) <> ''
      and address is not null
      and btrim(address) <> ''
    )
  )
  not valid;

notify pgrst, 'reload schema';
