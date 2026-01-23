-- 20260123_escrow_expire_stale_orders.sql
-- Expire stale escrow orders that were initialized but never paid.
-- Run:
--   supabase db push
--   supabase functions deploy escrow-expire --no-verify-jwt

create or replace function public.expire_stale_escrow_orders(cutoff_minutes integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_status text := 'abandoned';
begin
  begin
    with expired as (
      update public.escrow_orders
      set status = v_status,
          updated_at = now()
      where status = 'initialized'
        and paid_at is null
        and created_at < now() - make_interval(mins => cutoff_minutes)
      returning id, paystack_reference
    ), ins as (
      insert into public.escrow_events (provider, type, event_id, reference, escrow_order_id, payload)
      select
        'system',
        'order.' || v_status,
        'expire_' || id::text,
        paystack_reference,
        id,
        jsonb_build_object('cutoff_minutes', cutoff_minutes)
      from expired
      on conflict do nothing
    )
    select count(*) into v_count from expired;
    return v_count;
  exception
    when check_violation or invalid_text_representation or data_exception then
      v_status := 'expired';
      with expired as (
        update public.escrow_orders
        set status = v_status,
            updated_at = now()
        where status = 'initialized'
          and paid_at is null
          and created_at < now() - make_interval(mins => cutoff_minutes)
        returning id, paystack_reference
      ), ins as (
        insert into public.escrow_events (provider, type, event_id, reference, escrow_order_id, payload)
        select
          'system',
          'order.' || v_status,
          'expire_' || id::text,
          paystack_reference,
          id,
          jsonb_build_object('cutoff_minutes', cutoff_minutes)
        from expired
        on conflict do nothing
      )
      select count(*) into v_count from expired;
      return v_count;
  end;
end;
$$;

create index if not exists escrow_orders_initialized_created_at_idx
  on public.escrow_orders (created_at)
  where status = 'initialized' and paid_at is null;
