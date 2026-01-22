-- Escrow Phase E4-C: Paystack escrow orders + idempotent webhook events

create table if not exists public.escrow_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  buyer_id uuid not null,
  seller_id uuid not null,
  product_id uuid not null,
  currency text not null default 'NGN',
  amount_kobo bigint not null,
  status text not null default 'pending_payment',
  paystack_reference text unique,
  paystack_access_code text null,
  paid_at timestamptz null
);

create table if not exists public.escrow_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  provider text not null default 'paystack',
  event_type text not null,
  event_id text null,
  reference text null,
  order_id uuid null,
  payload jsonb not null
);

create unique index if not exists escrow_events_provider_event_id_uniq
  on public.escrow_events (provider, event_type, event_id)
  where event_id is not null;

create unique index if not exists escrow_events_provider_reference_uniq
  on public.escrow_events (provider, event_type, reference)
  where reference is not null;

alter table public.escrow_orders enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'escrow_orders'
      and policyname = 'escrow_orders_select_own'
  ) then
    create policy escrow_orders_select_own
      on public.escrow_orders
      for select
      using (buyer_id = auth.uid() or seller_id = auth.uid());
  end if;
end$$;
