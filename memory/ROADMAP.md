# ROADMAP.md — ShowMePrice.ng

Last updated: 2026-05-11

Update this file when priorities shift or a phase completes.
Do not add scope without removing or deferring something else.
A roadmap that only grows is not a roadmap.

---

## Phase 1 — Trust Loop Unification (current priority)

The singular most important thing to ship: a complete, production-grade
"Buy with Escrow" transaction flow where every step behaves as one unified
system.

### Pre-conditions (must fix first)

These are trust loop blockers. Nothing in Phase 1 can be trusted until these
are resolved:

- [ ] #1 Fix escrow fee mismatch — rewrite `src/lib/escrowFee.ts` to match
      edge function calculation (see KNOWN_ISSUES.md #1)
- [ ] #2 Fix password reset 404 — add `/reset-password` route to App.tsx
      (see KNOWN_ISSUES.md #2)
- [ ] #3 Fix WhatsApp reveal silent failure — change `FF.whatsapp_number` to
      `FF.whatsapp` in useContactReveal.ts (see KNOWN_ISSUES.md #3)

### Phase 1 scope — unified escrow pipeline

The current escrow system has the right architectural pieces but they do not
yet behave as one unified system. Phase 1 unifies:

1. **Buyer initiates escrow** from ProductDetail
   - Fee display matches backend calculation (pre-condition #1)
   - Order created in escrow_transactions + escrow_orders
   - Buyer receives confirmation

2. **Seller is notified**
   - Messaging thread linked to the escrow order
   - Seller can see order state from their dashboard

3. **Paystack webhook confirms payment**
   - escrow_orders + escrow_transactions updated atomically
   - Email to buyer + seller via notify function
   - Confirm RESEND_API_KEY is set and email actually sends

4. **Order state visible to both parties**
   - Buyer sees: payment confirmed → awaiting shipment → shipped → delivered
   - Seller sees: same states from their perspective
   - States are consistent between escrow_transactions and UI display

5. **Buyer confirms delivery (or opens dispute)**
   - Confirmation: transitions to pending_admin_release
   - Dispute: transitions to disputed, admin notified

6. **Admin reviews dispute if opened**
   - AdminEscrowPage shows open disputes
   - Admin can release to seller or refund buyer

7. **Funds released or refunded**
   - Release: Paystack transfer to seller bank account
   - seller_bank_accounts.paystack_recipient_code must be populated
   - Refund: Paystack refund to buyer
   - Email confirmation in both paths

### Phase 1 success criteria

A real test transaction can complete end-to-end without:
- Fee mismatch error
- Broken state transitions
- Missing notifications
- Admin unable to see or act on disputes
- Funds stuck in an unresolvable state

---

## Phase 2 — Marketplace Consistency Cleanup

After Phase 1 pre-conditions are fixed and the escrow pipeline is unified,
address the marketplace consistency layer issues:

- [ ] #4 Remove double FeatureFlagsProvider mount
- [ ] #5 Fix process.env.NODE_ENV → import.meta.env.MODE
- [ ] #6 Standardize admin identity checks to single field
- [ ] #7 Audit and fix is_active vs status column usage
- [ ] #8 Unify tier limits to single source of truth
- [ ] #9 Update MembershipTier type (requires account audit first)
- [ ] #10 Extract PaymentButton from PricingPage
- [ ] #11 Align image size limits (5MB vs 6MB)

Also in Phase 2:
- [ ] Confirm chat_filter edge function (KNOWN_ISSUES.md #13)
- [ ] Confirm pg_cron escrow expiry is running (#14)
- [ ] Add seller rejection email (#15)
- [ ] Run owner_id migration (#16)

---

## Phase 3 — Pre-Launch Hardening

Before first real users:

- [ ] Rate limiting on auth endpoints
- [ ] Error monitoring (Sentry or equivalent)
- [ ] Verify RESEND_API_KEY in production — confirm all transactional emails send
- [ ] End-to-end escrow smoke test with real Paystack test keys
- [ ] Review RLS policies on seller_verifications (useAdmin.rejectSeller does
      a direct DB write — confirm RLS prevents non-admin writes)
- [ ] Resolve README.md (currently a Google AI Studio boilerplate — wrong README)
- [ ] Type audit: address KNOWN_ISSUES.md #9 and #17

---

## Deferred (not abandoned)

- **Pro plan payment flow** — strategically undecided; no Paystack flow exists
  for Pro upgrade. Will be addressed when monetization strategy is finalized.
- **Delivery logistics** — deferred long-term. Feature flag exists, no
  implementation.
- **Image send in messaging** — desirable, not current priority.
- **Automated moderation / trust scoring** — future capability; manual review
  is current operational model.
- **Staging environment** — important as team and transaction volume grow;
  not warranted at current solo-dev scale.
- **CI/CD pipeline with test gates** — no automated tests exist yet; pipeline
  would be empty. Earns its place when tests exist.

---

## Not Planned

- Price comparison or price aggregation features
- Social commerce / feed ranking / engagement optimization
- Multi-currency or multi-processor architecture (without explicit approval)
- Logistics infrastructure
