-- 20260121022000_storage_products_bucket_policies.sql
-- Storage policies for 'products' bucket (DO NOT alter storage.objects; not allowed from migrations role)

do $$
begin
  -- Try to temporarily become storage admin (works if granted; otherwise it will just continue)
  begin
    execute 'set local role supabase_storage_admin';
  exception when insufficient_privilege then
    raise notice 'No privilege to set role supabase_storage_admin; continuing with current role.';
  end;

  -- Make idempotent
  begin execute 'drop policy if exists "Public read products" on storage.objects'; exception when others then null; end;
  begin execute 'drop policy if exists "Seller upload product images" on storage.objects'; exception when others then null; end;
  begin execute 'drop policy if exists "Seller update product images" on storage.objects'; exception when others then null; end;
  begin execute 'drop policy if exists "Seller delete product images" on storage.objects'; exception when others then null; end;

  -- Policies (assumes you upload as: storage.from("products").upload("<businessId>/<file>", ...))
  begin
    execute 'create policy "Public read products"
      on storage.objects for select
      to public
      using (bucket_id = ''products'')';

    execute 'create policy "Seller upload product images"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = ''products''
        and exists (
          select 1 from public.businesses b
          where b.user_id = auth.uid()
            and b.id::text = split_part(name, ''/'', 1)
        )
      )';

    execute 'create policy "Seller update product images"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = ''products''
        and exists (
          select 1 from public.businesses b
          where b.user_id = auth.uid()
            and b.id::text = split_part(name, ''/'', 1)
        )
      )
      with check (
        bucket_id = ''products''
        and exists (
          select 1 from public.businesses b
          where b.user_id = auth.uid()
            and b.id::text = split_part(name, ''/'', 1)
        )
      )';

    execute 'create policy "Seller delete product images"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = ''products''
        and exists (
          select 1 from public.businesses b
          where b.user_id = auth.uid()
            and b.id::text = split_part(name, ''/'', 1)
        )
      )';
  exception when insufficient_privilege then
    raise notice 'Insufficient privilege to create storage policies via migrations. Run the SQL manually in the Supabase SQL Editor as owner.';
  end;

  perform pg_notify('pgrst','reload schema');
end $$;
