-- 20260120230000_profiles_compat_columns_for_ui.sql
-- Compatibility columns expected by frontend useProfile select

alter table public.profiles
  add column if not exists display_name text;
alter table public.profiles
  add column if not exists username text;
alter table public.profiles
  add column if not exists user_type text;
alter table public.profiles
  add column if not exists is_admin boolean not null default false;
alter table public.profiles
  add column if not exists membership_tier text not null default 'free';
alter table public.profiles
  add column if not exists business_name text;
alter table public.profiles
  add column if not exists phone text;
alter table public.profiles
  add column if not exists city text;
alter table public.profiles
  add column if not exists address text;
-- state_id is referenced by the frontend; align type with public.states(id) if states exists
do $$
declare st_id_type text;
begin
  if to_regclass('public.states') is not null then
    select data_type into st_id_type
    from information_schema.columns
    where table_schema='public' and table_name='states' and column_name='id';

    if st_id_type is null then
      -- do nothing
      null;
    elsif st_id_type = 'bigint' then
      execute 'alter table public.profiles add column if not exists state_id bigint';
    elsif st_id_type = 'integer' then
      execute 'alter table public.profiles add column if not exists state_id integer';
    else
      -- fallback: keep as text if some unusual type
      execute 'alter table public.profiles add column if not exists state_id text';
    end if;

    -- add FK only if numeric type and not already present
    begin
      if st_id_type in ('bigint','integer') then
        execute '
          alter table public.profiles
          add constraint profiles_state_id_fkey
          foreign key (state_id)
          references public.states(id)
          on delete set null
        ';
      end if;
    exception when duplicate_object then null;
    end;
  else
    -- if states table doesn't exist, still add column so select doesn't fail
    execute 'alter table public.profiles add column if not exists state_id text';
  end if;
end $$;
-- Refresh PostgREST schema cache
select pg_notify('pgrst', 'reload schema');
