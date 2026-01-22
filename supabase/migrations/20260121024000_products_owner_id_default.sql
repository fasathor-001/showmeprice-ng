-- 20260121024000_products_owner_id_default.sql
-- Ensure products.owner_id is auto-filled and compatible with existing business_id model

do $$
begin
  if to_regclass('public.products') is null then
    raise exception 'public.products does not exist';
  end if;

  -- Ensure column exists (if it somehow doesn't)
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='owner_id'
  ) then
    alter table public.products add column owner_id uuid;
  end if;

  -- Backfill any existing nulls from businesses.user_id (safe)
  begin
    update public.products p
      set owner_id = b.user_id
    from public.businesses b
    where p.owner_id is null
      and p.business_id = b.id
      and b.user_id is not null;
  exception when undefined_column then
    null;
  end;

  -- Make inserts auto-fill owner_id in normal runtime (auth context)
  -- (This value will be evaluated at insert time for the logged-in user.)
  begin
    alter table public.products alter column owner_id set default auth.uid();
  exception when others then
    raise notice 'Could not set default owner_id = auth.uid() (ok to ignore if auth.uid() not available here).';
  end;

  perform pg_notify('pgrst','reload schema');
end $$;