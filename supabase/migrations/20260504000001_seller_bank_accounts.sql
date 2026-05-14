-- Seller bank accounts table for escrow payouts
create table if not exists seller_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  bank_code text not null,
  account_number text not null,
  account_name text not null,
  paystack_recipient_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seller_bank_accounts_seller_id_key unique (seller_id)
);

alter table seller_bank_accounts enable row level security;

-- Sellers can read and write their own bank account
create policy "seller_bank_accounts_select_own"
  on seller_bank_accounts for select
  using (auth.uid() = seller_id);

create policy "seller_bank_accounts_insert_own"
  on seller_bank_accounts for insert
  with check (auth.uid() = seller_id);

create policy "seller_bank_accounts_update_own"
  on seller_bank_accounts for update
  using (auth.uid() = seller_id);

-- Admins (service role) can read all for payout processing
-- (service role bypasses RLS by default)
