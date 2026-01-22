create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  meta jsonb;
  full_name text;
  display_name text;
  user_type text;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  full_name := nullif(trim(coalesce(meta->>'full_name', meta->>'fullName', meta->>'name', '')), '');
  display_name := nullif(trim(coalesce(meta->>'display_name', meta->>'displayName', '')), '');
  user_type := lower(nullif(trim(coalesce(meta->>'user_type', meta->>'userType', 'buyer')), ''));

  if full_name is null then
    raise exception 'handle_new_user failed: full_name is required';
  end if;
  if display_name is null then
    display_name := full_name;
  end if;
  if user_type not in ('buyer', 'seller', 'admin') then
    user_type := 'buyer';
  end if;

  if to_regclass('public.users') is not null then
    insert into public.users (id, email)
    values (new.id, new.email)
    on conflict (email) do update set id = excluded.id;
  end if;

  insert into public.profiles (id, full_name, display_name, user_type, created_at)
  values (new.id, full_name, display_name, user_type, now())
  on conflict (id) do update
    set full_name = excluded.full_name,
        display_name = excluded.display_name,
        user_type = excluded.user_type;

  return new;
exception
  when others then
    raise exception 'handle_new_user failed: %', sqlerrm;
end;
$$;

drop trigger if exists smp_on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
