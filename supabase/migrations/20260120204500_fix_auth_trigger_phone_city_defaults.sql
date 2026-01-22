-- Ensure signup trigger always supplies phone/city to satisfy constraints

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists smp_on_auth_user_created on auth.users;
drop trigger if exists smp_on_auth_user_created on auth.users;

drop function if exists public.handle_new_user() cascade;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb;
  full_name text;
  display_name text;
  user_type text;
  phone text;
  city text;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  full_name := nullif(trim(coalesce(meta->>'full_name', meta->>'fullName', meta->>'name', '')), '');
  display_name := nullif(trim(coalesce(meta->>'display_name', meta->>'displayName', '')), '');
  user_type := lower(nullif(trim(coalesce(meta->>'user_type', meta->>'userType', 'buyer')), ''));
  phone := nullif(trim(coalesce(meta->>'phone', meta->>'phone_number', '')), '');
  city := nullif(trim(coalesce(meta->>'city', '')), '');

  if full_name is null then
    full_name := 'New User';
  end if;
  if display_name is null then
    display_name := full_name;
  end if;
  if user_type not in ('buyer', 'seller', 'admin') then
    user_type := 'buyer';
  end if;

  if phone is null then
    phone := 'pending';
  end if;
  if city is null then
    city := 'pending';
  end if;

  if to_regclass('public.users') is not null then
    insert into public.users (id, email)
    values (new.id, new.email)
    on conflict (email) do update set id = excluded.id;
  end if;

  insert into public.profiles (id, full_name, display_name, user_type, phone, city, created_at)
  values (new.id, full_name, display_name, user_type, phone, city, now())
  on conflict (id) do update
    set full_name = excluded.full_name,
        display_name = excluded.display_name,
        user_type = excluded.user_type,
        phone = excluded.phone,
        city = excluded.city;

  return new;
end;
$$;

create trigger smp_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
