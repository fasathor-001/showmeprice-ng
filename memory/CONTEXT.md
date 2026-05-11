# CONTEXT.md — Current Project State

Last updated: 2026-05-11

Read this file at the start of every session. Update it at the end of any
session that changes project state: work completed, issues discovered,
priorities shifted, blockers resolved.

---

## Current Stage

Late alpha. Core systems exist. Trust loop is architecturally present but not
unified or production-hardened. Development and testing accounts only — no
real marketplace traction.

---

## What Was Just Completed (this session)

Knowledge base initialization. The CLAUDE.md operating system has been
established on the existing project. Files created:

- CLAUDE.md (root)
- docs/PRODUCT_OVERVIEW.md
- docs/ARCHITECTURE.md
- docs/DOMAIN.md
- docs/ENGINEERING_DOCTRINE.md (stub — requires Royal Ledger template)
- docs/README.md
- memory/CONTEXT.md (this file)
- memory/DECISIONS.md
- memory/KNOWN_ISSUES.md
- memory/ROADMAP.md
- memory/CHANGELOG.md
- CHANGELOG.md (root)

No code changes. No schema changes. Documentation and operating system only.

Prior to this session, the following fixes were made in recent sessions:

- Fixed buyer Deals page "Failed to load deals" error (is_active → status column)
- Fixed seller Deals page copy (removed internal flag descriptions as buyer-facing text)
- Fixed ProductDetail layout: left image column vertical alignment and height
- Fixed feature flags admin: RLS policies, audit log wiring, DELETE policy
- Fixed WhatsApp contact reveal (partially — see KNOWN_ISSUES.md #3)
- Fixed deals query error logging

---

## Active Priorities

1. **CRITICAL — Fix trust loop blockers before any real users**
   - #1 Escrow fee mismatch (frontend vs edge function)
   - #2 Password reset 404 (/reset-password route missing)
   - #3 WhatsApp reveal silent failure (FF.whatsapp_number bug)

2. **Buy-with-Escrow unification** — the singular near-term product priority.
   The full pipeline (buyer intent → seller notification → escrow payment →
   order state → messaging thread → dispute path → admin oversight → fund
   release) should behave as one unified system. Currently exists in fragments.
   See memory/ROADMAP.md.

3. **Marketplace consistency layer cleanup** — after trust loop blockers are
   fixed. See memory/KNOWN_ISSUES.md #4–10 and docs/ARCHITECTURE.md.

---

## Open Questions (unresolved as of this session)

- Does the `chat_filter` edge function exist in supabase/functions/?
  Treat as unconfirmed until verified.
- Is `RESEND_API_KEY` set in production? Email may be silently skipping.
- Is `pg_cron` escrow expiry running? Treat as incomplete until verified.
- Is supabase/migrations/ fully applied to production? Migration drift has
  occurred previously — do not assume alignment.
- Pro plan monetization: still strategically undecided. No Paystack flow exists
  for Pro tier upgrade.
- `membership_1` column in profiles: legacy naming artifact, unaudited.
  Do not extend. See KNOWN_ISSUES.md.

---

## What Is NOT Active (deferred, not abandoned)

- Delivery logistics — feature flag exists, no implementation
- Image send in messaging — UI stub present, not wired
- Automated moderation / trust scoring — future capability
- Pro plan payment flow — strategically undecided
- CI/CD pipeline beyond Cloudflare Git-connected deployment
- Staging environment

---

## Environment Notes

- Production Supabase project: kdpyndeizfgbchnrduzm.supabase.co
- No staging environment — all changes affect production directly
- Hosting: Cloudflare Pages, GitHub-connected (auto-deploy on merge)
- Local dev: localhost:5173 (strict port)
