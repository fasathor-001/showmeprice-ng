# ARCHITECTURE.md — ShowMePrice.ng

Last updated: 2026-05-11

---

## The Trust Loop

The trust loop is the end-to-end transaction flow that makes the platform
trustworthy. It spans multiple systems. Before touching any component in this
flow, re-read this section and check memory/KNOWN_ISSUES.md items #1–3.

```
[Seller] posts product listing
        ↓
[Buyer] browses, views ProductDetail
        ↓
[Buyer] initiates contact or escrow
        ↓  (if escrow)
paystack-init-escrow edge function
        ↓
Paystack payment page (buyer pays)
        ↓
paystack-webhook edge function (HMAC verified)
        ↓
escrow_orders + escrow_transactions updated
        ↓
notify edge function → email to buyer + seller
        ↓
[Seller] ships item, marks shipped
        ↓
[Buyer] confirms delivery — or opens dispute
        ↓  (if dispute)
Admin reviews via AdminEscrowPage
        ↓
escrow_actions edge function
        ↓  (release)              ↓  (refund)
Paystack transfer to seller    Paystack refund to buyer
        ↓
notify edge function → email confirmation
```

Current status: The architectural pieces exist. The unified pipeline — where
buyer intent, seller notification, order state, messaging thread, and admin
oversight behave as one system — is not yet complete. See memory/ROADMAP.md.

---

## Custom SPA Router

There is no React Router. This is a committed architectural decision.

Navigation model:
- `window.history.pushState(path)` + dispatch `smp:navigate` CustomEvent
- `useCurrentPath()` hook in App.tsx listens to `popstate` and `smp:navigate`
- Route matching is plain string comparison: `path === "/deals"`,
  `path.startsWith("/product/")`
- All route definitions live in `src/App.tsx` — add new routes there only
- Programmatic navigation: use `smpNavigate()` from `src/lib/smpNavigate.ts`

Do not add React Router. Do not add any client-side routing library.
See CLAUDE.md Guardrails.

### Legacy routing tension

`src/pages/HomePage.tsx` contains an internal `ViewMode` state machine
(`"landing" | "search" | "dashboard" | "pricing" | "profile" | "inbox" |
"institution" | "admin"`) that predates the App.tsx routing system. It still
handles several views as internal subviews rather than routes.

These two systems coexist in partial tension. Do not refactor without
architectural discussion — multiple pages currently depend on the HomePage
ViewMode pattern.

---

## Custom Event Bus

There is no Redux, Zustand, or state management library. Cross-component
communication uses custom DOM events dispatched on `window`.

Key events:

| Event | Purpose |
|---|---|
| `smp:navigate` | SPA navigation — router listens to this |
| `smp:toast` | Global toast notifications — Layout.tsx listens |
| `smp:open-auth` | Open login/register modal |
| `smp:products:refresh` | Trigger product feed refresh |
| `smp:edit-product` | Open PostProductForm in edit mode |
| `smp:view-inbox` | Open inbox, optionally to a thread |
| `smp:navigate-inbox` | Navigate within inbox |
| `smp:flags-updated` | Feature flags reloaded |
| `smp:open-post-deal` | Open PostProductForm in deal mode |

Global window functions registered by Layout.tsx:
- `window.openPostItemModal()` / `window.closePostItemModal()`
- `window.__smp_post_kind` — sets deal vs standard mode for PostProductForm
- `window.__SMP_PROFILE_CACHE__` — in-memory profile cache with 2-min TTL

Do not add a state management library. Do not bypass the event bus for
cross-component communication. See CLAUDE.md Guardrails.

---

## Feature Flag Systems

Three parallel implementations exist. This is known debt — see
memory/KNOWN_ISSUES.md.

### 1. `useFF` (src/hooks/useFF.ts)
- Lightweight hook used by most components
- Uses Supabase Realtime for live flag updates
- Returns named boolean aliases: `messaging`, `deals`, `escrow`, etc.
- `in_app_messaging_enabled` and `make_offer_enabled` default to `true`
  before DB load

### 2. `FeatureFlagsContext` (src/contexts/FeatureFlagsContext.tsx)
- React context provider, mounted in src/main.tsx
- Returns full flag rows with `visible_to` enforcement
- `in_app_messaging_enabled` hardcoded always-on
- Also mounted inside App.tsx — double-mount is a known issue (#4)

### 3. `useFeatureFlags` (src/hooks/useFeatureFlags.ts)
- Module-level cache with `CACHE` and `INFLIGHT` deduplication globals
- Has `canUserSee(UserContext)` — more powerful visibility logic
- Used by FeatureGate component and PostProductForm

When a feature flag controls what a user sees, verify behavior from both
seller and buyer perspectives. See Marketplace Consistency section below.

---

## Data Flow

```
User action
    ↓
React component
    ↓
Custom hook (src/hooks/)
    ↓
supabase-js client  ──────────────────────────────────────────┐
    ↓                                                          │
Supabase Postgres (RLS-gated)          Supabase Edge Function │
    ↓                                       (JWT-gated or     │
Realtime subscription                        secret-gated)    │
(feature flags, messages)                      ↓              │
                                        Paystack API          │
                                        Resend API ───────────┘
```

Direct DB writes are the norm. Edge functions are used for:
- Payment initiation and verification (Paystack)
- Escrow state transitions requiring server authority
- Seller approval (sends email via notify)
- Contact reveal (RPC)
- Bank account resolution (proxies Paystack)
- Chat filtering (existence unconfirmed — see KNOWN_ISSUES.md)

All authenticated edge function calls go through `invokeAuthedFunction()`
in `src/lib/invokeAuthedFunction.ts`, which validates the JWT and handles
401/session expiry.

---

## Authentication Model

- Supabase Auth, PKCE flow, storage key `smp-auth`
- Session persisted in localStorage
- Role in `profiles.role`: `'admin' | 'seller' | 'buyer' | 'user'`
- User type in `profiles.user_type`: `'seller' | 'buyer' | 'institution'`
- Role hint cached in localStorage `smp:role_hint:{userId}` to avoid
  repeated profile fetches
- `isSellerAccount` cached in localStorage `smp:user_type:{uid}`

Admin identity is checked inconsistently across the codebase — three different
fields are used: `profiles.role === 'admin'`, `profiles.is_admin === true`,
`profiles.user_type === 'admin'`. This is tracked in KNOWN_ISSUES.md.

All client-side role guards are UI gates only. Server-side enforcement is via
RLS policies and edge function JWT checks.

---

## Membership Tier System

Tiers in order: `free` → `pro` → `premium` → `institution` → `admin`

Note: `types.ts` still uses `'business'` for what is now `'premium'`. This is
a known type mismatch. See KNOWN_ISSUES.md. The runtime value is `'premium'`.

Access rules (verified in src/lib/plans.ts):
- Free buyers: in-app messaging only
- Pro/Premium/Institution buyers: contact reveal (WhatsApp + phone), escrow
- Premium buyers: can use escrow (if escrow_enabled flag is on)
- Sellers: tier controls listing count limits

Listing count limits have a known inconsistency between `constants.ts` and
`plans.ts`. See KNOWN_ISSUES.md #8.

---

## Edge Functions

Located in `supabase/functions/`. Deployed via Supabase CLI. Changes are
immediately live — there is no staging environment.

| Function | Auth | Purpose |
|---|---|---|
| `paystack-webhook` | HMAC signature (no JWT) | Receives Paystack events, updates escrow state |
| `paystack-init-escrow` | JWT | Initiates escrow payment, creates order record |
| `escrow-verify` | JWT | Polls Paystack to confirm payment, updates order |
| `escrow_actions` | No JWT (verify_jwt=false) | Buyer delivery confirm, dispute, admin release/refund |
| `notify` | Internal secret | Sends transactional email via Resend |
| `approve-seller` | JWT (admin only) | Approves seller verification, sends email |
| `offer_create` | JWT | Creates offer record, Paystack payment intent |
| `resolve-bank-account` | JWT | Proxies Paystack bank resolution endpoint |

`escrow_actions` has `verify_jwt = false` in config.toml — it performs its
own auth checks internally. Do not assume JWT presence in this function.

The `notify` function silently returns `{ ok: true, skipped: true }` if
`RESEND_API_KEY` is not set. Email delivery should not be assumed — see
KNOWN_ISSUES.md and CLAUDE.md DO NOT ASSUME section.

---

## Marketplace Consistency Layer

The marketplace consistency layer is a co-equal risk category alongside the
trust loop. Bugs here make the platform behave unpredictably for different
users — which damages trust even when individual transactions succeed.

Consistency drift occurs when the same concept is implemented two different
ways in different parts of the codebase. Verified instances:

| System | Inconsistency |
|---|---|
| Product status | `status = 'active'` (marketplace queries) vs `is_active = true` (submission count) |
| Tier names | `'business'` in types.ts vs `'premium'` at runtime |
| Tier limits | `constants.ts` {free:3, pro:20} vs `plans.ts` {free:2, pro:15} |
| Admin identity | Three fields checked: `role`, `is_admin`, `user_type` |
| Feature flags | Three parallel hook implementations |
| Feature flags provider | Mounted twice (main.tsx + App.tsx) |
| Routing | App.tsx path routing + HomePage.tsx ViewMode state machine |
| Escrow fee | Frontend calc (1.5% + ₦100) vs edge function (3%, ₦500 min) |

Before touching anything that affects what different user roles see, re-read
this section and verify the change from both seller and buyer perspectives.

---

## Database Tables (verified in codebase)

Core: `profiles`, `businesses`, `products`, `categories`, `states`

Commerce: `escrow_transactions`, `escrow_orders`, `escrow_events`,
          `escrow_disputes`, `offers`, `offer_payments`, `orders`,
          `payment_intents`, `seller_bank_accounts`

Engagement: `messages`, `product_saves`, `product_views`, `product_comments`,
            `product_reports`, `business_follows`

Trust: `seller_verifications`, `violation_logs`, `feature_flags`,
       `feature_flag_audit`

Institution: `institutions`, `procurement_logs`

Schema source of truth: `supabase/migrations/`
Do not treat `SMP_DB_REFERENCE.md` or root-level `.sql` files as authoritative.
