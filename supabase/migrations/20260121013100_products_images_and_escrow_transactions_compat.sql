-- 20260121013000_products_images_and_escrow_transactions_compat.sql
-- Products + escrow compatibility for fresh DB.

do $$
begin
  if to_regclass('public.products') is null then
    raise exception 'public.products does not exist';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='images'
  ) then
    alter table public.products
      add column images jsonb not null default '[]'::jsonb;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='condition'
  ) then
    alter table public.products
      add column condition text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='view_count'
  ) then
    alter table public.products
      add column view_count integer not null default 0;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='business_id'
  ) then
    alter table public.products add column business_id uuid;
  end if;

  if to_regclass('public.businesses') is not null then
    if not exists (
      select 1 from pg_constraint
      where conrelid='public.products'::regclass
        and conname='products_business_id_fkey'
        and contype='f'
    ) then
      alter table public.products
        add constraint products_business_id_fkey
        foreign key (business_id) references public.businesses(id)
        on delete set null;
    end if;
  end if;
end $$;

create or replace view public.escrow_transactions as
select * from public.escrow_orders;

grant select on public.escrow_transactions to authenticated;
grant select on public.escrow_transactions to anon;

select pg_notify('pgrst', 'reload schema');
