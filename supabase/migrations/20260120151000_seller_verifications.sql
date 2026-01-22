-- Seller verification workflow (MVP)

create table if not exists public.seller_verifications (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'unverified',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  rejection_reason text,
  id_type text,
  id_number text,
  id_image_url text,
  selfie_image_url text,
  cac_number text,
  business_name text,
  business_address text,
  social_links jsonb,
  updated_at timestamptz not null default now()
);

create unique index if not exists seller_verifications_seller_id_key
  on public.seller_verifications (seller_id);

alter table public.seller_verifications enable row level security;

drop policy if exists seller_verifications_select_own on public.seller_verifications;
create policy seller_verifications_select_own
  on public.seller_verifications
  for select
  using (auth.uid() = seller_id);

drop policy if exists seller_verifications_insert_own on public.seller_verifications;
create policy seller_verifications_insert_own
  on public.seller_verifications
  for insert
  with check (auth.uid() = seller_id and status = 'pending');

drop policy if exists seller_verifications_update_own on public.seller_verifications;
create policy seller_verifications_update_own
  on public.seller_verifications
  for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id and status = 'pending');

drop policy if exists seller_verifications_admin_select on public.seller_verifications;
create policy seller_verifications_admin_select
  on public.seller_verifications
  for select
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
  ));

drop policy if exists seller_verifications_admin_update on public.seller_verifications;
create policy seller_verifications_admin_update
  on public.seller_verifications
  for update
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
  ))
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
  ));

notify pgrst, 'reload schema';
