-- 20260121015000_businesses_unique_user_id.sql
-- Ensure one business per user for UPSERT (on_conflict=user_id)

do $$
begin
  if to_regclass('public.businesses') is null then
    raise exception 'public.businesses does not exist';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='user_id'
  ) then
    raise exception 'public.businesses.user_id does not exist';
  end if;

  -- Deduplicate (keep newest created_at per user_id)
  delete from public.businesses b
  using (
    select user_id, id,
           row_number() over (partition by user_id order by created_at desc nulls last, id desc) as rn
    from public.businesses
    where user_id is not null
  ) d
  where b.id = d.id
    and d.rn > 1;

  -- Unique index for ON CONFLICT user_id
  create unique index if not exists businesses_user_id_uidx on public.businesses(user_id);

  perform pg_notify('pgrst','reload schema');
end $$;