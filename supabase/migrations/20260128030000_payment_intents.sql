create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  intent text not null,
  target_id text not null,
  amount_kobo bigint not null,
  currency text not null default 'NGN',
  status text not null default 'initiated',
  provider text not null default 'paystack',
  reference text not null unique,
  authorization_url text null,
  paid_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
