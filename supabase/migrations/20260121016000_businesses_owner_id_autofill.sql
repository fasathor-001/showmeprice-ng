-- 20260121016000_businesses_owner_id_autofill.sql
-- Auto-fill businesses.owner_id (NOT NULL) from user_id/auth.uid() for seller setup upserts.

do $$
begin
  if to_regclass('public.businesses') is null then
    raise exception 'public.businesses does not exist';
  end if;
end $$;
create or replace function public.smp_businesses_owner_autofill()
returns trigger
language plpgsql
as $$
begin
  -- Always ensure owner_id is set
  new.owner_id := coalesce(new.owner_id, new.user_id, auth.uid());

  -- If businesses has user_id column, keep it in sync (client might only send owner_id)
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='businesses' and column_name='user_id'
  ) then
    new.user_id := coalesce(new.user_id, new.owner_id);
  end if;

  return new;
end
$$;
do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgname = 'trg_smp_businesses_owner_autofill'
      and tgrelid = 'public.businesses'::regclass
  ) then
    drop trigger trg_smp_businesses_owner_autofill on public.businesses;
  end if;

  create trigger trg_smp_businesses_owner_autofill
  before insert or update on public.businesses
  for each row
  execute function public.smp_businesses_owner_autofill();

  perform pg_notify('pgrst','reload schema');
end $$;
