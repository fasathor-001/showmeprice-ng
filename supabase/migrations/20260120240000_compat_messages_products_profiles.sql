-- 20260120240000_compat_messages_products_profiles.sql
-- Add compatibility columns + minimal RLS so current frontend queries work on the fresh DB.

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------
-- 1) MESSAGES: frontend expects messages.receiver_id and messages.read_at
-- -------------------------------------------------------------------

do $$
begin
  if to_regclass('public.messages') is null then
    -- Create a minimal messages table if it doesn't exist at all
    create table public.messages (
      id uuid primary key default gen_random_uuid(),
      sender_id uuid not null,
      receiver_id uuid not null,
      body text not null,
      product_id uuid null,
      created_at timestamptz not null default now(),
      read_at timestamptz null
    );
  end if;
end $$;

alter table public.messages
  add column if not exists sender_id uuid;

alter table public.messages
  add column if not exists receiver_id uuid;

alter table public.messages
  add column if not exists read_at timestamptz;

alter table public.messages
  add column if not exists created_at timestamptz not null default now();

alter table public.messages
  add column if not exists body text;

alter table public.messages
  add column if not exists product_id uuid;

-- Backfill receiver_id/sender_id from common legacy column names if present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='messages' and column_name='recipient_id'
  ) then
    update public.messages set receiver_id = recipient_id where receiver_id is null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='messages' and column_name='to_id'
  ) then
    update public.messages set receiver_id = to_id where receiver_id is null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='messages' and column_name='from_id'
  ) then
    update public.messages set sender_id = from_id where sender_id is null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='messages' and column_name='sender'
  ) then
    update public.messages set sender_id = sender where sender_id is null;
  end if;
end $$;

create index if not exists messages_receiver_read_idx
  on public.messages (receiver_id, read_at);

create index if not exists messages_sender_created_idx
  on public.messages (sender_id, created_at desc);

alter table public.messages enable row level security;

do $$
begin
  create policy "messages_select_own"
    on public.messages
    for select
    to authenticated
    using (sender_id = auth.uid() or receiver_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "messages_insert_sender"
    on public.messages
    for insert
    to authenticated
    with check (sender_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "messages_update_own"
    on public.messages
    for update
    to authenticated
    using (sender_id = auth.uid() or receiver_id = auth.uid())
    with check (sender_id = auth.uid() or receiver_id = auth.uid());
exception when duplicate_object then null;
end $$;

grant select, insert, update on public.messages to authenticated;

-- -------------------------------------------------------------------
-- 2) PROFILES: frontend is doing upsert POST /profiles?on_conflict=id (403 now)
--    Fix by adding insert policy (and ensure update policy exists)
-- -------------------------------------------------------------------

alter table public.profiles enable row level security;

do $$
begin
  create policy "profiles_select_own"
    on public.profiles
    for select
    to authenticated
    using (id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "profiles_insert_own"
    on public.profiles
    for insert
    to authenticated
    with check (id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "profiles_update_own"
    on public.profiles
    for update
    to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());
exception when duplicate_object then null;
end $$;

grant select, insert, update on public.profiles to authenticated;

-- -------------------------------------------------------------------
-- 3) PRODUCTS/BUSINESSES: fix common 400s from missing selected columns
--    Your frontend query references:
--      - products.is_deal
--      - businesses.verification_tier, businesses.verification_status
-- -------------------------------------------------------------------

alter table public.products
  add column if not exists is_deal boolean not null default false;

do $$
begin
  if to_regclass('public.businesses') is not null then
    alter table public.businesses add column if not exists verification_tier text;
    alter table public.businesses add column if not exists verification_status text;
  end if;
end $$;

-- Refresh PostgREST schema cache
select pg_notify('pgrst', 'reload schema');
