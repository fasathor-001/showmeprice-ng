update public.profiles
set display_name = full_name
where (display_name is null or display_name = '')
  and (full_name is not null and btrim(full_name) <> '');
update public.profiles
set full_name = coalesce(nullif(full_name,''), 'User ' || left(id::text, 6))
where full_name is null or btrim(full_name) = '';
alter table public.profiles
  alter column full_name set not null;
alter table public.profiles
  add constraint profiles_full_name_not_blank
  check (btrim(full_name) <> '');
notify pgrst, 'reload schema';
