-- 20260121010000_businesses_state_city.sql
-- Add state_id + city to businesses for seller setup compatibility.

do $$
begin
  if to_regclass('public.businesses') is null then
    raise exception 'public.businesses does not exist';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='state_id'
  ) then
    alter table public.businesses add column state_id integer;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='city'
  ) then
    alter table public.businesses add column city text;
  end if;

  if to_regclass('public.states') is not null then
    if not exists (
      select 1 from pg_constraint
      where conrelid='public.businesses'::regclass
        and conname='businesses_state_id_fkey'
        and contype='f'
    ) then
      alter table public.businesses
        add constraint businesses_state_id_fkey
        foreign key (state_id) references public.states(id)
        on delete set null
        not valid;
    end if;
  end if;

  create index if not exists businesses_state_id_idx on public.businesses(state_id);
end $$;
select pg_notify('pgrst','reload schema');
