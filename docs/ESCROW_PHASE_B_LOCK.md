# Escrow Phase B (Locked)

## Scope
Delivery confirmation, buyer disputes, and admin dispute resolution.
Do not change payment or fee logic.

## Routes
- Buyer escrow: `/account/escrow`
- Seller escrow: `/account/seller/escrow`
- Admin escrow: `/admin/escrow`

## Actions (Edge Function: `escrow_actions`)
Allowed actions:
- `buyer_confirm_delivery`
- `buyer_open_dispute`
- `admin_resolve_dispute`
- `admin_list_open_disputes`

### Buyer: Confirm Delivery
Rules:
- Must be buyer
- `status = 'paid'`
- `dispute_status = 'none'`
- `delivery_status != 'confirmed'`

### Buyer: Open Dispute
Rules:
- Must be buyer
- `status = 'paid'`
- `delivery_status != 'confirmed'`
- `dispute_status = 'none'`
- `payload.reason` required (min 10 chars)

### Admin: Resolve Dispute
Rules:
- Must be admin (profiles.is_admin = true)
- `dispute_status = 'open'`
- `payload.resolution` in `release_to_seller | refund_buyer`
- Does NOT modify `escrow_orders.status`

## Guardrails
- All actions return JSON: `{ ok, error?, detail? }`
- Unknown actions rejected with 400
- Admin list uses service role in `escrow_actions`

## Verification SQL
```sql
select id,status,delivery_status,dispute_status,dispute_reason,dispute_opened_at,dispute_resolved_at,resolution,released_at,refunded_at
from public.escrow_orders
order by dispute_opened_at desc
limit 20;

select created_at,type,escrow_order_id
from public.escrow_events
order by created_at desc
limit 30;
```

## Do Not Change
- Paystack init or webhook logic
- Escrow fee calculation
- Escrow status state machine
