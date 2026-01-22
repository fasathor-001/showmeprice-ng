-- 20260122033000_products_seller_business_name_on_business_update.sql
-- Keep products.seller_business_name in sync when businesses.business_name changes.

create or replace function public.sync_products_seller_business_name()
returns trigger
language plpgsql
as $$
begin
  if new.business_name is distinct from old.business_name then
    update public.products
    set seller_business_name = new.business_name
    where business_id = new.id;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_businesses_sync_products_seller_business_name'
  ) then
    create trigger trg_businesses_sync_products_seller_business_name
    after update of business_name on public.businesses
    for each row
    execute function public.sync_products_seller_business_name();
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
