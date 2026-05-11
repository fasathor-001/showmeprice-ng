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

Knowledge base setup is complete. Three commits are live on origin/master:

  f192f4e — chore: initialize CLAUDE.md operating system on existing project
  1d7af26 — docs: add ShowMePrice.ng engineering doctrine
  8bd3d1c — chore(docs): archive pre-existing historical artifacts

Files created:
- CLAUDE.md (root)
- docs/PRODUCT_OVERVIEW.md
- docs/ARCHITECTURE.md
- docs/DOMAIN.md
- docs/ENGINEERING_DOCTRINE.md (ShowMePrice.ng-specific engineering doctrine)
- docs/README.md
- memory/CONTEXT.md (this file)
- memory/DECISIONS.md
- memory/KNOWN_ISSUES.md (17 tracked issues)
- memory/ROADMAP.md
- memory/CHANGELOG.md
- CHANGELOG.md (root)

Files archived (git mv, history preserved):
- docs/archive/ESCROW_PHASE_B_LOCK.md
- docs/archive/PROJECT_CONTEXT.md

No code changes. No schema changes. Documentation and operating system only.

Prior to this session, the following fixes were made in earlier sessions:

- Fixed buyer Deals page "Failed to load deals" error (is_active → status column)
- Fixed seller Deals page copy (removed internal flag descriptions as buyer-facing text)
- Fixed ProductDetail layout: left image column vertical alignment and height
- Fixed feature flags admin: RLS policies, audit log wiring, DELETE policy
- Fixed deals query error logging

---

## Next Session Priority

Start the next session with the CRITICAL trust loop blockers, in this order.
These require fresh attention — do not begin as a follow-on to other work.

  1. #3 WhatsApp reveal silent failure
       One-line fix: FF.whatsapp_number → FF.whatsapp in useContactReveal.ts
       Also verify useSellerContact.ts for the same bug.

  2. #2 Password reset 404
       Add /reset-password route to App.tsx. Wire Supabase recovery token.
       Render new-password form. Confirm redirect URL allowlist.

  3. #1 Escrow fee mismatch
       Rewrite src/lib/escrowFee.ts to match edge function calculation:
       3%/₦500 minimum (free/pro), 2.5%/₦400 (premium), 2%/₦300 (institution).
       Do not touch VITE_ESCROW_FEE_PERCENT or VITE_ESCROW_FEE_FLAT_NGN.

After these three are fixed: Buy-with-Escrow unification (see ROADMAP.md Phase 1).

---

## Active Priorities

1. **CRITICAL — Fix trust loop blockers before any real users**
   - #3 WhatsApp reveal silent failure (FF.whatsapp_number bug) — fix first
   - #2 Password reset 404 (/reset-password route missing)
   - #1 Escrow fee mismatch (frontend vs edge function)

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
