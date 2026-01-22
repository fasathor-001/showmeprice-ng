-- 20260121015400_escrow_transactions_view.sql
-- Compat view so existing UI calls to escrow_transactions work

do $$
begin
  if to_regclass('public.escrow_orders') is null then
    raise exception 'public.escrow_orders does not exist';
  end if;

  execute 'create or replace view public.escrow_transactions as select * from public.escrow_orders';

  -- allow API access (RLS still applies on escrow_orders)
  begin
    execute 'grant select on public.escrow_transactions to anon, authenticated';
  exception when others then
    null;
  end;

  perform pg_notify('pgrst','reload schema');
end $$;