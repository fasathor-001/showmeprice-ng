-- 20260122032000_products_seller_business_name.sql
-- Snapshot seller business name on products for buyer-safe display.

alter table public.products
  add column if not exists seller_business_name text;

update public.products p
set seller_business_name = b.business_name
from public.businesses b
where p.business_id = b.id
  and (p.seller_business_name is null or p.seller_business_name = '');

create or replace function public.set_products_seller_business_name()
returns trigger
language plpgsql
as $$
begin
  if new.business_id is not null and (new.seller_business_name is null or new.seller_business_name = '') then
    select b.business_name
      into new.seller_business_name
    from public.businesses b
    where b.id = new.business_id;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_products_seller_business_name'
  ) then
    create trigger trg_products_seller_business_name
    before insert or update of business_id, seller_business_name
    on public.products
    for each row
    execute function public.set_products_seller_business_name();
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
