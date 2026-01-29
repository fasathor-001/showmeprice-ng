-- Escrow + payment_intents adjustments (idempotent)

-- Escrow orders: ensure kobo columns + references exist
alter table public.escrow_orders
  add column if not exists amount_kobo bigint,
  add column if not exists escrow_fee_kobo bigint,
  add column if not exists total_kobo bigint,
  add column if not exists currency text default 'NGN',
  add column if not exists status text default 'pending',
  add column if not exists paystack_reference text,
  add column if not exists payment_intent_id uuid,
  add column if not exists paid_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'escrow_orders_payment_intent_id_key'
  ) then
    alter table public.escrow_orders
      add constraint escrow_orders_payment_intent_id_key unique (payment_intent_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'escrow_orders_paystack_reference_key'
  ) then
    alter table public.escrow_orders
      add constraint escrow_orders_paystack_reference_key unique (paystack_reference);
  end if;
end $$;

-- Payment intents: ensure kind + metadata + status default exist
alter table public.payment_intents
  add column if not exists kind text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists paid_at timestamptz;

alter table public.payment_intents
  alter column status set default 'initialized';

alter table public.payment_intents enable row level security;

do $$
begin
  create policy "payment_intents_select_own"
    on public.payment_intents
    for select
    to public
    using (
      public.is_admin()
      or user_id = auth.uid()
    );
exception
  when duplicate_object then
    null;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
      and pronamespace = 'public'::regnamespace
  ) then
    if not exists (
      select 1
      from pg_trigger
      where tgname = 'set_payment_intents_updated_at'
    ) then
      create trigger set_payment_intents_updated_at
      before update on public.payment_intents
      for each row
      execute function public.set_updated_at();
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
