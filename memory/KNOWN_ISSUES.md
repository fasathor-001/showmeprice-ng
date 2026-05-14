# KNOWN_ISSUES.md — Tracked Issues

Last updated: 2026-05-14

Check this file before touching any system with a known open issue.
Add items when an issue is confirmed (not suspected).
Mark items resolved when the fix is verified, not when the fix is written.

Severity labels:
  CRITICAL  — blocks trust loop or causes data loss / payment failure
  HIGH      — affects user-facing behavior, measurable impact
  MEDIUM    — technical debt with known user-visible risk
  LOW       — tracked debt, low immediate impact

---

## CRITICAL — Trust Loop Blockers

### #1 — Escrow fee mismatch (frontend vs edge function)
Severity: CRITICAL
Status: OPEN

Frontend (`src/lib/escrowFee.ts`) displays escrow fee at 1.5% + ₦100 flat.
`paystack-init-escrow` edge function validates against 3% rate with ₦500
minimum. The edge function rejects requests where the amount doesn't match
its own calculation. Every escrow payment attempt will fail amount validation.

Fix required: Rewrite `src/lib/escrowFee.ts` to use the same formula as the
edge function (3% / ₦500 minimum for free/pro, 2.5% / ₦400 for premium,
2% / ₦300 for institution). Do NOT adjust env vars to compensate — the
mismatch is in the code logic. See docs/DOMAIN.md for the authoritative
fee structure.

Do not touch VITE_ESCROW_FEE_PERCENT or VITE_ESCROW_FEE_FLAT_NGN as a fix.
See CLAUDE.md Guardrails.

---

### #2 — Password reset redirects to a 404
Severity: CRITICAL
Status: RESOLVED — 2026-05-14

`useAuth.resetPassword()` sends a Supabase magic link with redirect to
`${window.location.origin}/reset-password`. That path is not registered in
`src/App.tsx` router. Users clicking password reset links land on a 404.

Resolution: Created `src/pages/ResetPasswordPage.tsx` and registered
`/reset-password` route in `src/App.tsx`. Page listens for
`onAuthStateChange PASSWORD_RECOVERY` event, shows a new-password form,
calls `supabase.auth.updateUser({ password })` on submit, and redirects to
`/` on success. If no recovery session arrives within 4 seconds (expired or
invalid link), shows a friendly error with a "Request new link" button.
`redirectTo` in `useAuth.resetPassword()` and `GlobalAuthModals.tsx` already
pointed to `/reset-password` — no changes needed there.

Owner action still required: Confirm Supabase Auth dashboard → URL
Configuration includes `${origin}/reset-password` in the redirect allow list.

---

### #3 — WhatsApp contact reveal silently fails
Severity: CRITICAL
Status: RESOLVED — 2026-05-14

`src/hooks/useContactReveal.ts` reads `FF.whatsapp_number` to check the
WhatsApp reveal feature flag. The correct export from `useFF` is `FF.whatsapp`
(not `FF.whatsapp_number`). `FF.whatsapp_number` is always `undefined`, so
the check `if (!FF.whatsapp_number)` is always true, silently blocking WhatsApp
reveals regardless of flag state.

Resolution: Changed `FF.whatsapp_number` to `FF.whatsapp` in both
`src/hooks/useContactReveal.ts` and `src/hooks/useSellerContact.ts`.
The wa.me URL formatting in `ProductDetail.tsx` handleWhatsApp() was already
correct (handles `0XXXXXXXXXX` and `+234XXXXXXXXX` input formats).
The RPC `reveal_seller_contact` returns `whatsapp_number` column from the
`businesses` table — the client already reads this via
`(row as any)?.whatsapp_number` — correct and unchanged.

---

## HIGH — Marketplace Consistency

### #4 — Double FeatureFlagsProvider mount
Severity: HIGH
Status: OPEN

`FeatureFlagsProvider` is mounted in both `src/main.tsx` and inside `src/App.tsx`.
This creates two React context providers. Child components use the inner one,
but both make DB fetches on mount — double network requests on every page load.
Potential source of subtle stale-data bugs if the two providers diverge.

Fix required: Remove one of the two mounts. Determine which mount point is
correct (main.tsx is the earlier and cleaner location) and remove the other.

---

### #5 — process.env.NODE_ENV fires debug log in production
Severity: HIGH
Status: OPEN

`src/hooks/useProducts.ts` guards a debug console.log with
`if (process.env.NODE_ENV !== 'production')`. In Vite/browser,
`process.env` is undefined. `undefined !== 'production'` evaluates to `true`,
so this debug log fires in production. The log outputs seller field data from
product objects.

Fix required: Replace `process.env.NODE_ENV` with `import.meta.env.MODE`
throughout the codebase. Verify no other `process.env.NODE_ENV` uses exist.

---

### #6 — Admin identity checked via three different fields
Severity: HIGH
Status: OPEN

Admin status is checked inconsistently: `profiles.role === 'admin'`,
`profiles.is_admin === true`, and `profiles.user_type === 'admin'` are all
used in different parts of the codebase. A user who is admin via one field
may not be recognized as admin in another path.

Fix required: Audit all admin checks and standardize on a single field.
Recommended: `profiles.role === 'admin'` as the canonical check.

---

### #7 — is_active vs status column inconsistency
Severity: HIGH
Status: OPEN (partially fixed)

`src/hooks/useProducts.ts` and `useProductSearch` filter products by
`status = 'active'`. `src/hooks/useProductSubmission.ts` counts products
where `is_active = true`. If `is_active` does not exist as a column
(products use `status`), the submission count check fails or throws.

Note: `useDealProducts.ts` was fixed in a recent session (changed
`is_active = true` to `status = 'active'`). The issue may remain in
`useProductSubmission.ts`.

Fix required: Audit all product queries for `is_active` usage and migrate
to `status = 'active'`.

---

### #8 — Tier limit inconsistency across three sources
Severity: HIGH
Status: OPEN

Three sources define listing count limits with different values:
- `src/constants.ts` TIER_LIMITS: `{ free: 3, pro: 20, business: Infinity }`
- `src/lib/plans.ts`: `{ free: 2, pro: 15, premium: unlimited }`
- `src/hooks/useProductSubmission.ts` enforces `constants.ts` values

UI may display limits from `plans.ts` while enforcement uses `constants.ts`.
The tier name `'business'` in constants.ts is also inconsistent with the
runtime `'premium'` tier name.

Fix required: Choose one source of truth for tier limits, update all references,
and normalize `'business'` to `'premium'`.

---

## MEDIUM — Type System Debt

### #9 — MembershipTier type out of sync with runtime
Severity: MEDIUM
Status: OPEN

`src/types.ts` defines `MembershipTier = 'free' | 'pro' | 'business'`.
Runtime system uses `'premium'` not `'business'`. TypeScript provides no
protection against this mismatch because `'business'` is a valid type value
that never appears in the DB.

Fix required: Update `MembershipTier` to `'free' | 'pro' | 'premium' |
'institution' | 'admin'`. Audit all uses of the `'business'` tier name.
Do not fix until all dependent logic is audited to avoid breaking membership
gating for any existing accounts.

---

### #10 — PaymentButton defined inside PricingPage function
Severity: MEDIUM
Status: OPEN

`PaymentButton` is a React component that uses `usePayment()` and `useState()`.
It is defined as a nested function inside the `PricingPage` function body.
React's rules of hooks require hooks to be called in the same component each
render, but defining a component inside a function body means it gets
re-created on every render of `PricingPage`. This causes the inner component
to remount on every parent render, resetting state.

Fix required: Extract `PaymentButton` to a top-level component.

---

### #11 — Image size limit mismatch
Severity: MEDIUM
Status: OPEN

`src/hooks/useImageUpload.ts` enforces 5MB max per image.
`src/components/seller/PostProductForm.tsx` enforces 6MB max.
Files between 5–6MB will pass the form validation but may fail at the hook.

Fix required: Align both to the same limit. Recommend choosing one value
and updating the other.

---

### #12 — membership_1 legacy column alias
Severity: MEDIUM
Status: OPEN — under audit

`src/hooks/useProfile.ts` selects `membership_1` and patches it onto the
profile as `membership_tier` if that field is absent. The origin of this
column alias is unclear — it may be a legacy column name, a migration remnant,
or a generated alias.

Do not introduce new code referencing `membership_1`.
Do not assume its meaning without auditing the profiles table schema.

Investigation required before any membership schema work.

---

## MEDIUM — Infrastructure Gaps

### #13 — chat_filter edge function existence unconfirmed
Severity: MEDIUM
Status: UNCONFIRMED

`src/pages/InboxPage.tsx` calls `invokeAuthedFunction("chat_filter", ...)`
when `chat_filtering_enabled` flag is on. The `chat_filter` edge function
was not found in `supabase/functions/` during the initial codebase audit.

If the function does not exist, enabling `chat_filtering_enabled` will cause
message sending to fail with a 404 for any chat message.

Action required: Verify whether `chat_filter` exists in the production
Supabase project. If absent, either create it or remove the call from
InboxPage.

---

### #14 — pg_cron escrow expiry not confirmed running
Severity: MEDIUM
Status: UNCONFIRMED

A migration adds `expire_stale_escrow_orders()` function with a comment
instructing manual setup: `SELECT cron.schedule(...)`. Whether this has been
run on the production Supabase instance is unknown.

If not running, stale `pending_payment` escrow orders accumulate indefinitely.

Action required: Verify in Supabase Dashboard → Extensions → pg_cron that
the schedule exists. If not, run it.

---

### #15 — Seller rejection sends no email notification
Severity: MEDIUM
Status: OPEN

`useAdmin.rejectSeller()` updates DB status to `'rejected'` via direct client
query but does not call the `notify` edge function. Seller approval sends a
confirmation email; rejection does not.

Fix required: Call `notify` edge function with a `seller_rejected` event type
after rejection, or add rejection notification handling to the `notify` function.

---

## LOW — Code Quality Debt

### #16 — owner_id → user_id migration incomplete
Severity: LOW
Status: OPEN — explicit TODO in code

Three hooks maintain dual-path owner lookups (checking `user_id` first, then
falling back to legacy `owner_id`): `useSeller.ts`, `useProfile.ts`,
`useAdmin.ts`. An explicit TODO comment in `useSeller.ts` documents the
one-time migration needed:

  UPDATE businesses SET user_id = owner_id WHERE user_id IS NULL;

Until run, legacy businesses with only `owner_id` populated require the
fallback. After running, the fallback code and `owner_id` column can be removed.

---

### #18 — Escrow pages showed cross-user orders (data isolation bug, seller + buyer)
Severity: CRITICAL
Status: RESOLVED — 2026-05-14

Both `EscrowSalesPage` and `EscrowOrdersPage` queried `escrow_orders` without
filtering by the current user's role-appropriate FK column. RLS allows SELECT
if `buyer_id = auth.uid() OR seller_id = auth.uid()`, which means a seller
visiting the sales page could also see any orders where they happened to be
a buyer (and vice versa). More critically, the absence of explicit page-level
filters exposed cross-user data if RLS was misconfigured or bypassed.

Resolution:
- Seller side (commit 975009d): Added `.eq("seller_id", currentUserId)` to
  `src/pages/EscrowSalesPage.tsx`.
- Buyer side (Fix 5.5): Added `.eq("buyer_id", currentUserId)` to
  `src/pages/EscrowOrdersPage.tsx`.

Both pages now guard against a null session (return early with empty rows if
no authenticated user). Defense in depth with RLS — explicit page-level
filter applied even though RLS covers the baseline case.

---

### #17 — 6 pre-existing TypeScript errors in tsc --noEmit
Severity: LOW
Status: OPEN — pre-existing, do not file as new failures

Files: App.tsx (×2), GlobalAuthModals.tsx (×2), FeatureGate.tsx (×1),
AccountShell.tsx (×1)

These errors existed before the CLAUDE.md system was established. Do not
treat them as new failures introduced by recent work. Address as part of the
planned type system audit (see #9).

Running `npx tsc --noEmit` will always show these 6 errors until fixed.
