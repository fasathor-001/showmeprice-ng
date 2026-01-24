create or replace function prevent_paid_escrow_regression()
returns trigger as $$
begin
  if old.status = 'paid' and new.status <> 'paid' then
    raise exception 'Cannot revert a paid escrow order';
  end if;
  return new;
end;
$$ language plpgsql;
drop trigger if exists trg_prevent_paid_escrow_regression on public.escrow_orders;
create trigger trg_prevent_paid_escrow_regression
  before update on public.escrow_orders
  for each row
  execute function prevent_paid_escrow_regression();
create unique index if not exists escrow_events_unique_type_order
  on public.escrow_events (escrow_order_id, type);
create or replace view admin_escrow_health as
select
  eo.id,
  eo.status,
  eo.paid_at,
  eo.updated_at,
  count(ev.id) as event_count
from public.escrow_orders eo
left join public.escrow_events ev on ev.escrow_order_id = eo.id
group by eo.id;
