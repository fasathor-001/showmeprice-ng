-- 20260124160000_profiles_onboarding_hardening.sql
-- Harden profiles onboarding + make public_profiles read-only.

alter table public.profiles
  add column if not exists phone_number text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'phone'
  ) then
    update public.profiles
    set phone_number = phone
    where phone_number is null and phone is not null;
  end if;
end $$;

alter table public.profiles
  add column if not exists full_name text;

alter table public.profiles
  add column if not exists city text;

alter table public.profiles
  add column if not exists state text;

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

drop view if exists public.public_profiles;
drop table if exists public.public_profiles;

create view public.public_profiles as
select
  p.id as user_id,
  nullif(
    coalesce(
      to_jsonb(p)->>'display_name',
      to_jsonb(p)->>'full_name',
      nullif(trim(concat_ws(' ', to_jsonb(p)->>'first_name', to_jsonb(p)->>'last_name')), ''),
      to_jsonb(p)->>'username'
    ),
    ''
  ) as display_name,
  nullif(
    coalesce(
      to_jsonb(p)->>'avatar_url',
      to_jsonb(p)->>'avatar',
      to_jsonb(p)->>'avatar_path',
      to_jsonb(p)->>'photo_url',
      to_jsonb(p)->>'profile_photo_url'
    ),
    ''
  ) as avatar_url,
  p.created_at,
  p.updated_at
from public.profiles p;

grant select on public.public_profiles to anon, authenticated;

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
