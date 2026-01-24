update public.profiles
set full_name = null
where full_name ~* '^(user|buyer|seller)\\s+[a-z0-9]{5,6}$';
update public.profiles
set display_name = null
where display_name ~* '^(user|buyer|seller)\\s+[a-z0-9]{5,6}$';
alter table public.profiles
  drop constraint if exists profiles_full_name_not_blank;
alter table public.profiles
  add constraint profiles_full_name_not_blank
  check (full_name is not null and btrim(full_name) <> '')
  not valid;
notify pgrst, 'reload schema';
