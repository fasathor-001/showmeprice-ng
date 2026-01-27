-- Make Offer end-to-end tables

-- Offers
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'NGN',
  message text null,
  status text not null default 'sent' check (status in (
    'sent','pending','countered','accepted','declined','canceled','cancelled','expired','paid'
  )),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- compatibility fields for existing UI
  conversation_id uuid null,
  offer_amount_kobo bigint null,
  accepted_amount_kobo bigint null,
  accepted_by uuid null,
  accepted_at timestamptz null,
  declined_by uuid null,
  declined_at timestamptz null,
  cancelled_by uuid null,
  cancelled_at timestamptz null,
  escrow_order_id uuid null,
  product_title_snapshot text null,
  listed_price_kobo bigint null
);

create index if not exists offers_buyer_id_idx on public.offers (buyer_id);
create index if not exists offers_seller_id_idx on public.offers (seller_id);
create index if not exists offers_product_id_idx on public.offers (product_id);
create index if not exists offers_status_idx on public.offers (status);
create index if not exists offers_expires_at_idx on public.offers (expires_at);

-- Offer events
create table if not exists public.offer_events (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  actor_id uuid not null,
  type text not null check (type in ('created','counter','accept','decline','cancel','expire')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists offer_events_offer_id_idx on public.offer_events (offer_id);
create index if not exists offer_events_actor_id_idx on public.offer_events (actor_id);

-- Offer payments
create table if not exists public.offer_payments (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  buyer_id uuid not null,
  idempotency_key text not null,
  reference text not null unique,
  amount_kobo bigint not null,
  currency text not null default 'NGN',
  status text not null default 'initialized' check (status in ('initialized','paid','failed')),
  paystack_access_code text null,
  authorization_url text null,
  raw_init_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (offer_id, idempotency_key)
);

create index if not exists offer_payments_offer_id_idx on public.offer_payments (offer_id);
create index if not exists offer_payments_buyer_id_idx on public.offer_payments (buyer_id);

-- Orders for non-escrow offer payments
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'offer',
  offer_id uuid unique references public.offers(id) on delete set null,
  product_id uuid not null,
  buyer_id uuid not null,
  seller_id uuid not null,
  amount numeric(12,2) not null,
  currency text not null default 'NGN',
  status text not null default 'paid',
  created_at timestamptz not null default now()
);

create index if not exists orders_buyer_id_idx on public.orders (buyer_id);
create index if not exists orders_seller_id_idx on public.orders (seller_id);

-- updated_at trigger for offers + offer_payments
create trigger set_offers_updated_at
before update on public.offers
for each row
execute function public.set_updated_at();

create trigger set_offer_payments_updated_at
before update on public.offer_payments
for each row
execute function public.set_updated_at();

-- Server-side seller_id resolution from product
create or replace function public.set_offer_seller_id()
returns trigger
language plpgsql
as $$
begin
  if new.seller_id is null then
    select p.owner_id into new.seller_id
    from public.products p
    where p.id = new.product_id;

    if new.seller_id is null then
      select coalesce(b.owner_id, b.user_id) into new.seller_id
      from public.products p
      join public.businesses b on b.id = p.business_id
      where p.id = new.product_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger set_offer_seller_id
before insert on public.offers
for each row
execute function public.set_offer_seller_id();

-- RLS
alter table public.offers enable row level security;
alter table public.offer_events enable row level security;
alter table public.offer_payments enable row level security;
alter table public.orders enable row level security;

-- Offers policies
create policy offers_select_own
  on public.offers
  for select
  using (buyer_id = auth.uid() or seller_id = auth.uid());

create policy offers_insert_buyer
  on public.offers
  for insert
  with check (buyer_id = auth.uid());

create policy offers_update_seller
  on public.offers
  for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

-- Offer events policies
create policy offer_events_select_own
  on public.offer_events
  for select
  using (exists (
    select 1 from public.offers o where o.id = offer_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  ));

-- Offer payments policies
create policy offer_payments_select_own
  on public.offer_payments
  for select
  using (exists (
    select 1 from public.offers o where o.id = offer_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  ));

-- Orders policies
create policy orders_select_own
  on public.orders
  for select
  using (buyer_id = auth.uid() or seller_id = auth.uid());
