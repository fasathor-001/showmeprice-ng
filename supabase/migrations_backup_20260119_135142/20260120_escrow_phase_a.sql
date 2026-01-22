-- Escrow Phase A: schema + RLS (idempotent)

create extension if not exists pgcrypto;
-- Admin users table
create table if not exists public.admin_users (
  user_id uuid primary key references public.profiles(id) on delete cascade
);
alter table public.admin_users enable row level security;
-- Helper to check admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
  );
$$;
do $$
begin
  create policy "admin_users_select"
    on public.admin_users
    for select
    to public
    using (public.is_admin());
exception
  when duplicate_object then
    null;
end $$;
do $$
begin
  create policy "admin_users_all"
    on public.admin_users
    for all
    to public
    using (public.is_admin())
    with check (public.is_admin());
exception
  when duplicate_object then
    null;
end $$;
-- Escrow status enum
do $$
begin
  create type public.escrow_status as enum (
    'draft',
    'initialized',
    'funded',
    'released',
    'refunded',
    'cancelled'
  );
exception
  when duplicate_object then
    null;
end $$;
-- Escrow orders
create table if not exists public.escrow_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  amount int not null check (amount > 0),
  currency text not null default 'NGN',
  status public.escrow_status not null default 'draft',
  paystack_reference text unique,
  paystack_access_code text,
  paystack_authorization jsonb,
  paid_at timestamptz,
  product_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint escrow_orders_buyer_seller_check check (buyer_id <> seller_id)
);
create index if not exists escrow_orders_buyer_created_at_idx
  on public.escrow_orders (buyer_id, created_at desc);
create index if not exists escrow_orders_seller_created_at_idx
  on public.escrow_orders (seller_id, created_at desc);
create index if not exists escrow_orders_product_id_idx
  on public.escrow_orders (product_id);
create index if not exists escrow_orders_status_idx
  on public.escrow_orders (status);
-- Updated-at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_escrow_orders_updated_at'
  ) then
    create trigger set_escrow_orders_updated_at
      before update on public.escrow_orders
      for each row
      execute function public.set_updated_at();
  end if;
end $$;
alter table public.escrow_orders enable row level security;
do $$
begin
  create policy "escrow_orders_select"
    on public.escrow_orders
    for select
    to public
    using (
      public.is_admin()
      or buyer_id = auth.uid()
      or seller_id = auth.uid()
    );
exception
  when duplicate_object then
    null;
end $$;
-- Escrow events
create table if not exists public.escrow_events (
  id uuid primary key default gen_random_uuid(),
  escrow_order_id uuid,
  type text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.escrow_events
  add column if not exists escrow_order_id uuid;
alter table public.escrow_events
  add column if not exists type text;
alter table public.escrow_events
  add column if not exists payload jsonb;
alter table public.escrow_events
  add column if not exists created_at timestamptz;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'escrow_events_escrow_order_id_fkey'
  ) then
    alter table public.escrow_events
      add constraint escrow_events_escrow_order_id_fkey
      foreign key (escrow_order_id)
      references public.escrow_orders(id)
      on delete cascade;
  end if;
end $$;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'escrow_events'
      and column_name = 'escrow_order_id'
  ) then
    if not exists (
      select 1 from public.escrow_events where escrow_order_id is null
    ) then
      alter table public.escrow_events
        alter column escrow_order_id set not null;
    end if;
  end if;
end $$;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'escrow_events'
      and column_name = 'type'
  ) then
    if not exists (
      select 1 from public.escrow_events where type is null
    ) then
      alter table public.escrow_events
        alter column type set not null;
    end if;
  end if;
end $$;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'escrow_events'
      and column_name = 'escrow_order_id'
  ) then
    create index if not exists escrow_events_order_created_at_idx
      on public.escrow_events (escrow_order_id, created_at desc);
  end if;
end $$;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'escrow_events'
      and column_name = 'type'
  ) then
    create index if not exists escrow_events_type_idx
      on public.escrow_events (type);
  end if;
end $$;
alter table public.escrow_events enable row level security;
do $$
begin
  create policy "escrow_events_select"
    on public.escrow_events
    for select
    to public
    using (
      public.is_admin()
      or exists (
        select 1
        from public.escrow_orders eo
        where eo.id = escrow_order_id
          and (eo.buyer_id = auth.uid() or eo.seller_id = auth.uid())
      )
    );
exception
  when duplicate_object then
    null;
end $$;
