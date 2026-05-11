# CLAUDE.md — ShowMePrice.ng Operating System

This file is the authoritative operating system for all agent-assisted work on
this project. Read it at the start of every session before taking any action.

It does not describe what to build. It describes how to work here: the rules,
the constraints, the current state, and where to find everything else.

When this file conflicts with any other file in the repository — including
AGENTS.md, docs/, memory/, or comments in code — this file wins.

Last updated: 2026-05-11

---

## Quick Reference

1. Working directory: C:\Users\fasat\Pictures\app\showmeprice-ng — the only
   authoritative repo.
2. Frankie is the founder. Speak to him directly, refer to him by name,
   never lecture.
3. The product is in late alpha. Production is live and discoverable. Treat
   every change as production-affecting.
4. Sequential commits with review gates. Never bundle unrelated changes.
5. Verify before claiming. Honest uncertainty is better than confident error.
6. Trust loop bugs are not technical debt. They are damage to the platform's
   reason to exist.

---

## Project

Project: ShowMePrice.ng
One-line description: Trust-first local marketplace for Nigeria — transparent
pricing, verified sellers, escrow-backed transactions.

---

## Project Status

Stage:        Late alpha. Core systems exist. Trust loop is architecturally
              present but not unified or production-hardened.

Users:        Development and testing accounts only. No real marketplace
              traction yet. This is not license for low-discipline work —
              the trust-first positioning means launch-quality must be
              established BEFORE first real users, not after. Bug debt
              accumulated now becomes first-impression damage at launch.

Stability:    Do not assume any system is production-stable without checking
              memory/KNOWN_ISSUES.md and memory/CONTEXT.md first.

Staging:      No separate staging environment. Production Supabase project is
              kdpyndeizfgbchnrduzm.supabase.co. Changes to schema or edge
              functions affect production directly.

Caution:      "No real users yet" does NOT mean "low stakes for production work."
              The Supabase project is live and discoverable. Bad migrations,
              broken edge functions, or schema errors are immediately visible
              to anyone hitting the production URL. Treat production as
              production from day one.

Priority:     Buy-with-Escrow unification — see memory/ROADMAP.md for sequencing.

---

## Stack

Frontend:     React 18 + TypeScript 5.8, Vite 7, Tailwind CSS v4
Backend:      Supabase (Postgres + RLS, Auth, Storage, Edge Functions, Realtime)
Payments:     Paystack (NGN only — no other currency, no other processor)
Email:        Resend via notify edge function (silent no-op if key absent)
Hosting:      Cloudflare Pages, GitHub-connected deployment
TypeScript discipline: types exist but are not consistently load-bearing — some
              types are out of sync with runtime values (see KNOWN_ISSUES.md).
              Treat type signatures as guidance, not enforced contracts, until
              the types are audited.
No React Router — custom SPA router only (see ARCHITECTURE.md)
No Redux/Zustand — custom smp:* event bus only (see ARCHITECTURE.md)

---

## Local Development

npm run dev          → Vite dev server, localhost:5173 (strict port)
npm run build        → production build to dist/
npm run lint         → ESLint
npm run lint:strict  → ESLint, zero warnings tolerated
npx tsc --noEmit     → typecheck only (6 pre-existing errors tracked in
                       KNOWN_ISSUES.md — do not file as new failures)

Required env vars (frontend):
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY
  VITE_PAYSTACK_PUBLIC_KEY

Optional env vars (frontend):
  VITE_ESCROW_MIN_PRICE_NGN   (default 50000)
  VITE_ESCROW_FEE_PERCENT     (default 1.5 — WARNING: frontend value is calculated
                               differently than the backend edge function. Tweaking
                               this does NOT fix the mismatch — the mismatch is a
                               code bug, see KNOWN_ISSUES.md #1. Do not change to
                               attempt to align with the edge function.)
  VITE_ESCROW_FEE_FLAT_NGN    (default 100 — same warning as above)

---

## Repository Structure

Key entry points:
  src/main.tsx              → app boot; FeatureFlagsProvider wraps everything here
  src/App.tsx               → all route definitions; custom SPA router lives here
                              add new routes here and nowhere else
  src/pages/HomePage.tsx    → contains an internal ViewMode state machine handling
                              several "page" views. Legacy from the original
                              architecture, coexists with App.tsx routing in partial
                              tension. Do not refactor without architectural
                              discussion — multiple pages currently depend on
                              this pattern.
  src/lib/supabase.ts       → Supabase client singleton
  src/lib/plans.ts          → tier definitions, escrow fee rates, access rules
                              source of truth for plan logic (frontend side)
  src/hooks/                → all data-fetching and business logic
  src/pages/                → one file per route, named to match the route
  src/components/layout/    → Navbar, Layout, AccountShell, MobileBottomNav
  src/components/auth/      → GlobalAuthModals (login / register / reset)
  src/components/product/   → ProductDetail — main buyer-facing product view
  src/components/seller/    → PostProductForm — global post/edit product modal
  supabase/functions/       → edge functions (Deno) — server-side logic
  supabase/migrations/      → canonical schema source of truth
                              do not treat root-level .sql files as authoritative

---

## Session Start Protocol

At the start of every session, in this order:
  1. CLAUDE.md (this file)         → operating rules, guardrails, knowledge base index
  2. memory/CONTEXT.md             → current state and active priorities
  3. memory/KNOWN_ISSUES.md        → what is tracked and broken
  4. Relevant docs/ file           → only if the session touches that domain

Do not read all docs/ files on every session. Read CONTEXT.md and KNOWN_ISSUES.md
first, then pull additional files as the work requires them.

If memory/CONTEXT.md appears stale (last updated more than a few sessions ago,
or does not reflect the work just completed), update it before closing the session.

Beyond session start:
  - Read memory/DECISIONS.md before proposing any structural change. Many things
    have been considered and decided. Check before suggesting alternatives.
  - Read memory/ROADMAP.md when planning what to work on next, not when fixing
    something specific.

Handling missing files:
  If a file referenced in this index does not exist, do not silently skip it.
  Offer to create it with substantive content — not placeholder content.
  Files earn their place through use. Pre-fabricated empty files create noise.

---

## Knowledge Base

  docs/PRODUCT_OVERVIEW.md      → what showmeprice.ng is, what it is not, target
                                   users, trust loop as the product, anti-positioning
  docs/ARCHITECTURE.md          → trust loop diagram, custom routing model, feature
                                   flag systems, data flow, edge functions, marketplace
                                   consistency layer
  docs/DOMAIN.md                → Nigerian market specifics: Paystack, NGN, state
                                   handling, WhatsApp-first contact, escrow fee
                                   structure as single source of truth
  docs/ENGINEERING_DOCTRINE.md  → analytical discipline, troubleshooting methodology,
                                   mentorship rules; consult when reasoning depth is
                                   genuinely required, not on every session
  docs/README.md                → navigation index for docs/

  memory/CONTEXT.md             → current project state, active focus, open
                                   priorities; read this first at the start of
                                   every session
  memory/DECISIONS.md           → architectural decisions with rationale and
                                   commitment level; check before proposing
                                   structural changes
  memory/KNOWN_ISSUES.md        → 17 tracked issues, severity-labeled; check before
                                   touching any system with a known open issue
  memory/ROADMAP.md             → Buy-with-Escrow unification as Phase 1; current
                                   sequencing of near-term work
  memory/CHANGELOG.md           → one-line pointer to root CHANGELOG.md (satisfies
                                   the required-files spec without duplicating the
                                   authoritative changelog)

  CHANGELOG.md                  → running record of significant changes

  AGENTS.md                     → pre-existing agent guidelines from before the
                                   CLAUDE.md system; covers custom router and event
                                   bus patterns. CLAUDE.md is the authoritative
                                   operating system; AGENTS.md is supplementary
                                   context. If the two ever conflict, CLAUDE.md wins.

---

## Guardrails

Read before writing any code.

NEVER:
  - Add React Router. Navigation uses window.history.pushState + smp:navigate
    events. New routes go in src/App.tsx only. This is committed and intentional.
  - Add Redux, Zustand, or any state management library. Cross-component
    communication uses the smp:* custom event bus. This is committed and
    intentional.
  - Use process.env.NODE_ENV — this is undefined in Vite/browser. Use
    import.meta.env.MODE instead.
  - Treat TypeScript type signatures as enforced contracts. Types are guidance
    only until the type audit is complete (see KNOWN_ISSUES.md).
  - Change VITE_ESCROW_FEE_PERCENT or VITE_ESCROW_FEE_FLAT_NGN to "fix" the
    escrow fee mismatch. The mismatch is a code bug. See KNOWN_ISSUES.md #1.
  - Broaden the product to multi-currency or multi-processor architecture without
    explicit approval. Paystack + NGN is the only payment path and the only stored
    currency. Tactical handling of foreign-currency display (exchange rates,
    receipts, etc.) is fine; structural support for non-NGN amounts is a major
    architectural decision that requires explicit discussion first.
  - Treat root-level .sql files as authoritative or apply them to production.
    Canonical migrations are in supabase/migrations/ only. Root-level .sql files
    are reference fragments or stale artifacts — not the source of truth.
  - Introduce new code referencing membership_1. It is a legacy naming artifact
    under audit. See KNOWN_ISSUES.md.
  - Pre-fabricate runbooks/, workflows/, TROUBLESHOOTING.md, or PATTERNS.md.
    These files earn their place through use, not anticipation.
  - Add engagement, social, or feed-ranking features. The product is a trust-first
    transaction platform, not a social commerce platform.

DO NOT ASSUME:
  - That the chat_filter edge function exists. Treat as unconfirmed until verified.
  - That RESEND_API_KEY is set in production. Email may be silently skipping.
  - That pg_cron escrow expiry is running. Treat as incomplete until verified.
  - That supabase/migrations/ is fully applied to production. Migration drift
    has occurred previously.
  - That is_active and status refer to the same column. They do not. See
    KNOWN_ISSUES.md #7.
  - That the hardcoded "kdpyndeizfgbchnrduzm.supabase.co" string in supabase.ts
    is a typo or comment. It is the production project host used in URL validation.
    Do not remove or modify without understanding the validation logic that
    depends on it.

BEFORE touching the trust loop (escrow, verification, dispute, contact reveal,
payment confirmation):
  - Re-read docs/ARCHITECTURE.md trust loop section
  - Re-read memory/KNOWN_ISSUES.md items #1–3
  - These systems are the product. Bugs here are not technical debt.
    They are damage to the platform's reason to exist.

BEFORE touching anything that affects what different user roles see (feature
flags, routing, product visibility, admin role checks, tier names, storage
permissions):
  - Re-read docs/ARCHITECTURE.md marketplace consistency section
  - Verify the change behaves correctly from BOTH seller and buyer perspectives
  - Watch for symptoms of drift: same concept implemented two ways, same column
    with two names, same flag with three hooks, same role with three field checks
  - Consistency drift is a class of bug that damages trust by making the platform
    behave unpredictably. Both risk categories matter equally.

---

## If In Doubt

Before making a change you are uncertain about:
  1. Check memory/KNOWN_ISSUES.md — the issue may already be tracked
  2. Check memory/DECISIONS.md — the decision may already be made
  3. Check docs/ARCHITECTURE.md — the constraint may already be documented

If uncertainty remains after checking:
  - For code changes: prefer asking over guessing. If the question is small
    and the change is reversible, proceed with a clearly-marked comment
    explaining the uncertainty. If the question is large or the change is not
    easily reversible, stop and ask.
  - For schema changes: do not proceed without explicit owner confirmation.
  - For anything touching the trust loop or escrow: stop and ask rather than
    guess. These systems handle real money and real trust. A wrong guess here
    is not recoverable with a quick follow-up commit.

The cost of asking is one message. The cost of a wrong trust loop change is
user trust, which does not recover quickly.

---

## Commit Conventions

Format:       <type>: <short imperative description>
              Types: feat, fix, chore, docs, refactor, style, test
Body:         Include when the why is not obvious from the diff.

Deployment:   Cloudflare Pages deploys automatically from GitHub on merge.
              There is no staging gate. Every merged commit is live.
              Do not merge broken builds.

Schema changes: Run migrations against production Supabase directly — there
              is no staging environment. Double-check every migration before
              running. Destructive migrations require explicit owner approval
              before execution. "Destructive" includes: DROP statements,
              ALTER COLUMN that changes type or removes data, removing
              constraints that were enforcing referential integrity, and any
              migration that cannot be reversed by a simple subsequent migration.

Edge functions: Deployed via Supabase CLI. Changes are immediately live.
              If local Docker tooling is available and stable, test with
              supabase functions serve before deploying. If local tooling is
              not reliable (Docker issues have affected this project previously),
              review the function code carefully and deploy to a non-critical
              path first. Do not deploy blind.

Rule:         One concern per commit. Do not bundle documentation, code changes,
              and schema changes in a single commit. Reviewability matters.

---

## Maintaining the Knowledge Base

  memory/CONTEXT.md        → update at the end of any session that changes the
                             current state of the project: new work completed,
                             new issues discovered, priorities shifted, blockers
                             resolved. If you read it at the start of a session,
                             update it at the end.

  memory/KNOWN_ISSUES.md   → add items when a new issue is confirmed (not
                             suspected). Mark items resolved when the fix is
                             verified, not when the fix is written. Include the
                             resolution in the entry.

  memory/DECISIONS.md      → add an entry when a structural decision is made that
                             a future agent might reverse without context. The entry
                             should record what was decided, why, and what the
                             alternative was.

  memory/ROADMAP.md        → update when priorities shift or a phase completes.
                             Do not add scope without removing or deferring
                             something else. A roadmap that only grows is not
                             a roadmap.

  CHANGELOG.md (root)      → add an entry for every session that produces a
                             commit. Format: date, one-line summary, files changed.

  docs/ files              → update when the system they describe changes. Stale
                             architecture documentation is worse than no
                             documentation — it actively misleads.

  CLAUDE.md (this file)    → change only when operating rules, guardrails, or
                             project-level facts change. Do not edit to reflect
                             current work. That is what memory/ is for.

---

## Pre-existing Files at Repo Root

  AGENTS.md              → see Knowledge Base section above

  SMP_DB_REFERENCE.md    → database schema reference document, pre-dating this
                           knowledge base. Treat as a useful snapshot, not as
                           authoritative. The canonical schema source of truth
                           is supabase/migrations/. If SMP_DB_REFERENCE.md
                           contradicts a migration file, the migration file wins.

  PHASE1-CHECKPOINT.md   → development phase logs (PHASE1 through PHASE11).
  through                  Historical record of how the project evolved. Read
  PHASE11-CHECKPOINT.md    for context on past decisions; do not treat as
                           current architecture documentation. If a checkpoint
                           contradicts current state (code, schema, or behavior),
                           current state wins. The contradiction itself may be
                           useful — it suggests a decision was made and reversed
                           at some point.

  Root-level .sql files  → stale migration artifacts and reference fragments.
                           See Guardrails — do not treat as authoritative.
