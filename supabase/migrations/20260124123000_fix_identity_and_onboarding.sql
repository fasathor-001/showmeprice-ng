-- 20260124123000_fix_identity_and_onboarding.sql
-- Identity/onboarding hardening: profiles as source of truth, safe public_profiles compatibility.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  name_text text;
  email_prefix text;
begin
  name_text := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), '');
  if name_text is null then
    email_prefix := split_part(coalesce(new.email, ''), '@', 1);
    name_text := nullif(initcap(replace(replace(email_prefix, '.', ' '), '_', ' ')), '');
  end if;

  insert into public.profiles (id, email, full_name, display_name)
  values (new.id, new.email, name_text, name_text)
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

do $do$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'smp_on_auth_user_created'
  ) then
    create trigger smp_on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $do$;

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own'
  ) then
    create policy profiles_select_own
      on public.profiles
      for select
      to authenticated
      using (id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_insert_own'
  ) then
    create policy profiles_insert_own
      on public.profiles
      for insert
      to authenticated
      with check (id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own
      on public.profiles
      for update
      to authenticated
      using (id = auth.uid())
      with check (id = auth.uid());
  end if;
end $$;

do $do$
declare
  rel_kind "char";
begin
  select c.relkind into rel_kind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'public_profiles';

  if rel_kind in ('r', 'p') then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'public_profiles' and column_name = 'user_id'
    ) then
      alter table public.public_profiles add column user_id uuid;
    end if;

    update public.public_profiles
    set user_id = id
    where user_id is null;

    alter table public.public_profiles
      alter column user_id set not null;

    create or replace function public.public_profiles_set_user_id()
    returns trigger
    language plpgsql
    as $fn$
    begin
      new.user_id := new.id;
      return new;
    end;
    $fn$;

    if not exists (
      select 1 from pg_trigger
      where tgname = 'trg_public_profiles_set_user_id'
    ) then
      create trigger trg_public_profiles_set_user_id
      before insert or update on public.public_profiles
      for each row execute function public.public_profiles_set_user_id();
    end if;
  end if;
end $do$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'businesses' and column_name = 'user_id'
  ) then
    execute 'alter table public.businesses alter column user_id set default auth.uid()';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'businesses' and column_name = 'owner_id'
  ) then
    execute 'alter table public.businesses alter column owner_id set default auth.uid()';
  end if;
end $$;
