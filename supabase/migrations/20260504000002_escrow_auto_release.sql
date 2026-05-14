-- Auto-release function for stale escrow orders
-- Called by the escrow-expire edge function on a cron schedule
create or replace function expire_stale_escrow_orders(cutoff_minutes int default 30)
returns int
language plpgsql
security definer
as $$
declare
  expired_count int;
begin
  -- Mark escrow_orders as expired if still in pending_payment after cutoff
  update escrow_orders
  set
    status = 'expired',
    updated_at = now()
  where
    status in ('pending_payment', 'initialized', 'pending')
    and created_at < now() - (cutoff_minutes || ' minutes')::interval;

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

-- Schedule: run every 30 minutes via pg_cron
-- Requires pg_cron extension to be enabled in your Supabase project.
-- Run this manually in the SQL editor once pg_cron is enabled:
--
--   select cron.schedule(
--     'expire-stale-escrow',
--     '*/30 * * * *',
--     $$
--       select expire_stale_escrow_orders(30);
--     $$
--   );
--
-- To verify the schedule is active:
--   select * from cron.job;
