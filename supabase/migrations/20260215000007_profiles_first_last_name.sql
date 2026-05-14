-- Add missing name columns safely (backfill from full_name)
do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles
      add column if not exists first_name text;
    alter table public.profiles
      add column if not exists last_name text;
  end if;
end $$;

update public.profiles
set first_name = coalesce(first_name, nullif(split_part(full_name, ' ', 1), '')),
    last_name = coalesce(
      last_name,
      nullif(trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 2)), '')
    )
where full_name is not null
  and (first_name is null or last_name is null);
