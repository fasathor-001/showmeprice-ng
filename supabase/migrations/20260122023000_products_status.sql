-- 20260122023000_products_status.sql
-- Add status field for products (active | sold)

alter table public.products
  add column if not exists status text;

alter table public.products
  alter column status set default 'active';

update public.products
set status = 'active'
where status is null;

alter table public.products
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_status_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_status_check
      check (status in ('active','sold'));
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
