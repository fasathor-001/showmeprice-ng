-- 20260121014000_businesses_seller_profile_compat.sql
-- Make businesses compatible with seller profile fetch/upsert.

do $$
begin
  if to_regclass('public.businesses') is null then
    raise exception 'public.businesses does not exist';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='user_id'
  ) then
    alter table public.businesses add column user_id uuid;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='owner_id'
  ) then
    alter table public.businesses add column owner_id uuid;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='description'
  ) then
    alter table public.businesses add column description text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='whatsapp_number'
  ) then
    alter table public.businesses add column whatsapp_number text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='phone_number'
  ) then
    alter table public.businesses add column phone_number text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='address'
  ) then
    alter table public.businesses add column address text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='links'
  ) then
    alter table public.businesses add column links jsonb not null default '[]'::jsonb;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='created_at'
  ) then
    alter table public.businesses add column created_at timestamptz not null default now();
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='updated_at'
  ) then
    alter table public.businesses add column updated_at timestamptz not null default now();
  end if;

  -- Backfill/sync user_id and owner_id
  update public.businesses set user_id = owner_id where user_id is null and owner_id is not null;
  update public.businesses set owner_id = user_id where owner_id is null and user_id is not null;
end $$;
create or replace function public.smp_sync_business_owner_user()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null and new.owner_id is not null then
    new.user_id := new.owner_id;
  end if;
  if new.owner_id is null and new.user_id is not null then
    new.owner_id := new.user_id;
  end if;
  return new;
end $$;
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_smp_sync_business_owner_user'
  ) then
    create trigger trg_smp_sync_business_owner_user
      before insert or update on public.businesses
      for each row execute function public.smp_sync_business_owner_user();
  end if;
end $$;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'businesses_user_id_fkey'
  ) then
    alter table public.businesses
      add constraint businesses_user_id_fkey
      foreign key (user_id) references public.profiles(id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'businesses_owner_id_fkey'
  ) then
    alter table public.businesses
      add constraint businesses_owner_id_fkey
      foreign key (owner_id) references public.profiles(id)
      on delete cascade;
  end if;
end $$;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'businesses_user_id_key'
  ) then
    if not exists (
      select 1
      from public.businesses
      where user_id is not null
      group by user_id
      having count(*) > 1
    ) then
      alter table public.businesses add constraint businesses_user_id_key unique (user_id);
    else
      create index if not exists businesses_user_id_idx on public.businesses(user_id);
    end if;
  end if;
end $$;
select pg_notify('pgrst', 'reload schema');
