-- 20260121020100_escrow_transactions_view_reset.sql
-- NO-OP (deprecated): this migration previously referenced non-existent columns (amount_total).
-- Keeping as no-op to avoid blocking future pushes.
select pg_notify('pgrst','reload schema');
