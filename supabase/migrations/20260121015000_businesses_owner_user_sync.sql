-- 20260121015000_businesses_owner_user_sync.sql
-- Ensure businesses user_id/owner_id are present and synced.

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

  update public.businesses set user_id = owner_id where user_id is null and owner_id is not null;
  update public.businesses set owner_id = user_id where owner_id is null and user_id is not null;
end $$;

create or replace function public.smp_sync_business_owner_user()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
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

create unique index if not exists businesses_user_id_key
  on public.businesses(user_id)
  where user_id is not null;

select pg_notify('pgrst', 'reload schema');
