-- Ensure escrow_events exists for Paystack webhook idempotency

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
