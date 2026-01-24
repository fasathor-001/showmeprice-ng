-- Idempotency for Paystack webhook retries
-- Paystack can send duplicate events; these indexes make inserts safe.

create unique index if not exists escrow_events_idempotency_uniq
on public.escrow_events(provider, type, reference)
where provider is not null and type is not null and reference is not null;
create unique index if not exists escrow_events_event_id_uniq
on public.escrow_events(provider, event_id)
where provider is not null and event_id is not null;
-- Note: NOT VALID constraints on escrow_orders should be validated explicitly if desired:
-- alter table public.escrow_orders validate constraint escrow_amounts_positive;
-- alter table public.escrow_orders validate constraint escrow_min_amount_guardrail;;
