create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  full_name text;
  display_name text;
  user_type text;
  email_name text;
begin
  full_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');
  if full_name is null then
    email_name := split_part(coalesce(new.email, ''), '@', 1);
    full_name := nullif(trim(email_name), '');
  end if;
  if full_name is null then
    full_name := 'New User';
  end if;

  display_name := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');
  if display_name is null then
    display_name := full_name;
  end if;

  user_type := coalesce(new.raw_user_meta_data->>'user_type', 'buyer');

  if to_regclass('public.users') is not null then
    insert into public.users (id, email)
    values (new.id, new.email)
    on conflict (id) do nothing;
  end if;

  insert into public.profiles (id, full_name, display_name, user_type, created_at)
  values (new.id, full_name, display_name, user_type, now())
  on conflict (id) do nothing;

  return new;
exception
  when others then
    raise exception 'handle_new_user failed: %', sqlerrm;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
