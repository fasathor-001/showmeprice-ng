# CHANGELOG — ShowMePrice.ng

Most recent entry first.

---

## 2026-05-14 — Phase 1: Launch-Ready Core Flows (5 fixes, 5 commits)

Five production-blocking issues resolved. No new dependencies introduced.
No schema migrations.

Fixes:
  1. Add /reset-password route — users clicking Supabase password reset
     emails now land on a functional form instead of a 404. Page handles
     PASSWORD_RECOVERY event, updates password via updateUser, redirects
     home on success, shows expired-link screen for invalid tokens.
     (src/pages/ResetPasswordPage.tsx, src/App.tsx)

  2. EscrowSalesPage seller filter — sellers could see all escrow orders
     across all users. Added .eq("seller_id", currentUserId) to the
     EscrowSalesPage query. Data isolation bug closed.
     (src/pages/EscrowSalesPage.tsx)

  3. Production verification audit — pre-launch checkpoint document
     created covering chat_filter edge function deployment, RESEND_API_KEY,
     pg_cron escrow expiry, owner_id migration, May 2026 migrations, and
     Paystack key prefix. 3 owner-action items identified.
     (docs/PROD_AUDIT_2026-05-14.md)

  4. WhatsApp contact reveal fix — FF.whatsapp_number (always undefined)
     changed to FF.whatsapp (correct useFF export) in useContactReveal.ts
     and useSellerContact.ts. WhatsApp reveals were silently blocked for
     all Pro+ users regardless of feature flag state.
     (src/hooks/useContactReveal.ts, src/hooks/useSellerContact.ts)

  5. SEO description cleanup — replaced literal "whatsapp_number" DB column
     name leak in the default site-wide meta description with proper copy.
     (src/components/common/SEO.tsx)

KNOWN_ISSUES.md: Items #2, #3 marked RESOLVED. Item #18 added (EscrowSalesPage
data isolation — retroactive, marked resolved). EscrowOrdersPage buyer-side
filter gap noted but not fixed (out of scope).

---

## 2026-05-11 — Knowledge base initialization

Established CLAUDE.md operating system on existing project. Documentation and
operating system only — no code changes, no schema changes.

Files created:
  CLAUDE.md
  docs/PRODUCT_OVERVIEW.md
  docs/ARCHITECTURE.md
  docs/DOMAIN.md
  docs/ENGINEERING_DOCTRINE.md  (stub — requires Royal Ledger template)
  docs/README.md
  memory/CONTEXT.md
  memory/DECISIONS.md
  memory/KNOWN_ISSUES.md        (17 tracked issues)
  memory/ROADMAP.md
  memory/CHANGELOG.md
  CHANGELOG.md                  (this file)

Prior work captured in CONTEXT.md and KNOWN_ISSUES.md:
  - Fixed buyer Deals page "Failed to load deals" (is_active → status)
  - Fixed seller Deals page copy (removed internal flag descriptions)
  - Fixed ProductDetail layout alignment and height
  - Fixed feature flags admin: RLS policies, audit log wiring, DELETE policy
  - Fixed deals query error logging
