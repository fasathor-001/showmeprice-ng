-- 20260122_010000_products_update_policy.sql
-- Allow business owners to update/delete their products

alter table public.products enable row level security;
drop policy if exists products_update_own_business on public.products;
create policy products_update_own_business
on public.products
for update
to authenticated
using (
  exists (
    select 1
    from public.businesses b
    where b.id = products.business_id
      and b.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.businesses b
    where b.id = products.business_id
      and b.user_id = auth.uid()
  )
);
drop policy if exists products_delete_own_business on public.products;
create policy products_delete_own_business
on public.products
for delete
to authenticated
using (
  exists (
    select 1
    from public.businesses b
    where b.id = products.business_id
      and b.user_id = auth.uid()
  )
);
select pg_notify('pgrst', 'reload schema');
