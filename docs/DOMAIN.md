# DOMAIN.md — ShowMePrice.ng Nigerian Market Specifics

Last updated: 2026-05-11

This file is the single source of truth for Nigerian market specifics and
domain constants. When domain-specific values appear in multiple places in the
codebase, this file documents the authoritative version and flags discrepancies.

---

## Currency

- All amounts are stored and processed in Nigerian Naira (NGN)
- Display: `Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" })`
  via `formatNaira()` in `src/lib/plans.ts`
- Paystack amounts are in kobo (1 NGN = 100 kobo)
- There is no multi-currency support. Tactical display of exchange rates or
  foreign-currency receipts is acceptable; structural storage of non-NGN amounts
  requires explicit architectural approval
- The ₦ symbol is used throughout the UI

---

## Payment Processor

Paystack is the only payment processor. This is not an oversight — it is the
correct choice for NGN transactions in Nigeria.

Paystack integration points:
- Frontend: `VITE_PAYSTACK_PUBLIC_KEY` env var, loaded via CDN script injection
  in PricingPage (not via react-paystack package despite it being installed)
- Backend: `PAYSTACK_SECRET_KEY` Supabase secret
- Webhook: `paystack-webhook` edge function, HMAC-SHA512 verified
- Escrow init: `paystack-init-escrow` edge function
- Escrow verify: `escrow-verify` edge function
- Fund transfer to seller: `escrow_actions` edge function (`admin_release_to_seller`)
- Bank resolution: `resolve-bank-account` edge function

Do not add a second payment processor. Do not add Stripe, Flutterwave, or any
non-Paystack payment path without explicit architectural approval.

---

## Escrow Fee Structure — Single Source of Truth

There is a known mismatch between the frontend fee display and the backend
validation. This section documents both, and documents the authoritative value.

**Authoritative (backend):** `paystack-init-escrow` edge function
- Rate: 3% of transaction amount
- Minimum fee: ₦500
- Applies to: free and pro tier buyers
- Premium tier: 2.5%, minimum ₦400 (per plans.ts)
- Institution/admin: 2%, minimum ₦300 (per plans.ts)

**Current frontend (incorrect):** `src/lib/escrowFee.ts`
- Rate: `VITE_ESCROW_FEE_PERCENT` (default 1.5%)
- Flat fee: `VITE_ESCROW_FEE_FLAT_NGN` (default ₦100)
- This calculation differs from the backend and causes payment rejection

**Resolution required:** Unify frontend fee display to match backend calculation.
This is KNOWN_ISSUES.md #1 and a trust loop blocker. Do not adjust env vars
to attempt alignment — the fix is in `src/lib/escrowFee.ts` code logic.

Minimum escrow transaction: ₦50,000 (default, configurable via
`VITE_ESCROW_MIN_PRICE_NGN`)

---

## Nigerian States

- 37 entries: 36 states + Federal Capital Territory
- Stored in the `states` table with `id` (integer) and `name` (text)
- Priority sort applied in `useStates()`: Lagos first, Abuja (FCT) second,
  then alphabetical
- FCT normalization: "abuja", "fct", "abuja fct", "federal capital territory"
  all normalize to "Abuja (FCT)"
- `state_id` is an integer FK in products and profiles
- Registration form uses text `sellerState` (string) — a known inconsistency
  with the integer `state_id` used elsewhere

---

## WhatsApp-First Contact Model

WhatsApp is the primary contact method for seller-buyer communication in Nigeria.
The platform is designed around this reality.

Contact reveal model:
- Free buyers: in-app messaging only
- Pro/Premium/Institution buyers: can reveal seller WhatsApp number and phone
- Reveal is gated by `reveal_seller_contact` RPC
- `phone_call_enabled` and `whatsapp_contact_enabled` feature flags provide
  admin control over reveal availability
- Known bug: `useContactReveal.ts` reads `FF.whatsapp_number` (undefined)
  instead of `FF.whatsapp`. See KNOWN_ISSUES.md #3.

The in-app messaging system (`messages` table) is always-on regardless of
WhatsApp reveal status. `in_app_messaging_enabled` feature flag is hardcoded
to always return `true`.

---

## Seller Verification Model

Manual admin review is the current and intended operational model.

Verification flow:
1. Seller submits: ID type, ID number, ID image URL, selfie URL, CAC number
2. Admin reviews in AdminApprovalsPage
3. Approval: `approve-seller` edge function updates `seller_verifications` +
   `businesses` tables, sends email via `notify`
4. Rejection: direct DB update by `useAdmin.rejectSeller()` — no email sent
   (known gap, see KNOWN_ISSUES.md)

Verification tiers in `businesses.verification_tier`:
`'basic' | 'verified' | 'premium'`

Verified sellers receive a badge in product cards and ProductDetail.
Unverified status is not shown to buyers — only positive trust signals are
displayed.

---

## Membership Tiers

Runtime tier values (authoritative):

| Tier | Value | Listing limit | Contact reveal | Escrow |
|---|---|---|---|---|
| Free | `'free'` | 2 | No | No |
| Pro | `'pro'` | 15 | Yes | No |
| Premium | `'premium'` | Unlimited | Yes | Yes |
| Institution | `'institution'` | Unlimited | Yes | Yes |
| Admin | `'admin'` | Unlimited | Yes | Yes |

Note: `types.ts` uses `'business'` for what is now `'premium'`. This is a
known type mismatch — do not introduce new code using `'business'` as a tier
name. See KNOWN_ISSUES.md.

Note: `constants.ts` TIER_LIMITS uses `{free:3, pro:20}` which differs from
the values above. `useProductSubmission` enforces constants.ts values. The
discrepancy is a known issue — see KNOWN_ISSUES.md #8.

---

## Product Categories

14 root categories defined in `src/constants.ts` as `MOCK_CATEGORIES` with
hardcoded IDs 1–14. Subcategories are in the `categories` table (parent_id
relationship). If the DB `categories` table is empty, `useHubs()` falls back
to `MOCK_CATEGORIES`.

---

## Chat and Content Filtering

`ANTI_LEAK_PATTERNS` in `src/constants.ts`: regex array blocking phone numbers,
email addresses, @handles, URLs, and the word "whatsapp" in messages.

Controlled by `chat_filtering_enabled` feature flag. When enabled, the
`chat_filter` edge function is called before message delivery.

Note: existence of the `chat_filter` edge function is unconfirmed. Treat as
potentially absent. See CLAUDE.md DO NOT ASSUME section.
