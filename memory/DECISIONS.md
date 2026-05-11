# DECISIONS.md — Architectural Decisions

Last updated: 2026-05-11

Before proposing any structural change, read this file. Many things have been
considered and decided. Check before suggesting alternatives.

Each entry records: what was decided, why, what the alternative was, and how
committed the decision is.

---

## D-001 — Custom SPA Router (no React Router)

**Decision:** Navigation uses `window.history.pushState` + `smp:navigate`
custom event. All route definitions live in `src/App.tsx`. No React Router
or equivalent library.

**Why:** Intentional architectural choice, documented in pre-existing AGENTS.md.
Provides full control over navigation behavior without framework constraints.
The custom event bus model was already established; routing fits naturally into
the same pattern.

**Alternative considered:** React Router v6.

**Commitment level:** Fully committed. Extensive code built on this pattern.
Reversing would require rewriting navigation throughout every page and
component. Do not suggest React Router.

**Decided:** Pre-dates CLAUDE.md system. Origin in early project architecture.

---

## D-002 — Custom Event Bus (no state management library)

**Decision:** Cross-component communication uses `window.dispatchEvent` /
`window.addEventListener` with `smp:*` prefixed events. No Redux, Zustand,
Jotai, or equivalent.

**Why:** Avoids framework coupling, keeps components lightweight, fits naturally
with the custom SPA router model. Global functions (`window.openPostItemModal`,
`window.__SMP_PROFILE_CACHE__`) follow the same pattern.

**Alternative considered:** Zustand for lightweight state management.

**Commitment level:** Fully committed. The event bus is used throughout every
major component and hook.

**Decided:** Pre-dates CLAUDE.md system. Origin in early project architecture.

---

## D-003 — Supabase for Everything

**Decision:** Auth, database, storage, edge functions, and realtime all on
Supabase. No separate backend API server.

**Why:** Reduces operational complexity. Supabase provides all required
primitives. RLS handles authorization at the database layer.

**Alternative considered:** Separate Express/Fastify backend.

**Commitment level:** Fully committed. Every hook and component touches Supabase
directly. Not reversible without a full rewrite.

**Decided:** Pre-dates CLAUDE.md system.

---

## D-004 — Paystack Only, NGN Only

**Decision:** Paystack is the only payment processor. NGN is the only stored
and processed currency. No multi-currency or multi-processor architecture.

**Why:** Nigeria-first product. Paystack is the dominant processor for NGN
transactions. Multi-currency support is architectural complexity with no
current value for the target market.

**Alternative considered:** Flutterwave (also supports NGN but Paystack was
preferred). Stripe (not suitable for NGN-primary use case).

**Commitment level:** Fully committed. Tactical display of foreign-currency
exchange rates is acceptable. Structural non-NGN amounts require explicit
approval before any implementation.

**Decided:** Pre-dates CLAUDE.md system.

---

## D-005 — Manual Admin Moderation

**Decision:** Seller verification, dispute resolution, and violation review are
handled by human admin review. No automated scoring or decision systems.

**Why:** Trust infrastructure for an emerging market where automated systems
have lower reliability and the cost of a wrong automated decision (approving a
scammer, rejecting a legitimate seller) is high. Human-auditable review is
appropriate for the current scale.

**Alternative considered:** Automated verification scoring.

**Commitment level:** Current operational model. Automation may assist in the
future (flagging, scoring for human review) but trust review should remain
human-auditable. This is not a permanent ceiling — it is the correct approach
for the current stage.

**Decided:** Confirmed by Frankie, 2026-05-11.

---

## D-006 — No Staging Environment

**Decision:** There is one Supabase project (production). Schema changes and
edge function deployments go directly to production.

**Why:** Current scale and team size (solo development) does not justify the
operational overhead of maintaining a separate staging environment.

**Alternative considered:** Supabase branching (preview environments).

**Commitment level:** Current operational reality, not a permanent decision.
As team size and transaction volume grow, a staging environment becomes
increasingly important. For now: treat production as production from day one,
double-check migrations, use `supabase functions serve` locally when Docker
is available.

**Decided:** Confirmed by Frankie, 2026-05-11.

---

## D-007 — Feature Flags as First-Class System

**Decision:** Product behavior is controlled by named feature flags stored in
a `feature_flags` DB table, managed via an admin UI with audit logging. Ten
named flags covering messaging, deals, escrow, contact reveal, delivery,
institution tools, chat filtering, and make-offer.

**Why:** Allows safe rollout of trust-critical features (escrow, contact reveal)
without code deploys. Admin can disable/enable features without engineering
involvement. Audit log provides accountability.

**Alternative considered:** Environment variable–only feature control.

**Commitment level:** Fully committed. The flag system is in production with
RLS policies, an audit table, and admin UI.

**Known debt:** Three parallel hook implementations exist for reading flags
(`useFF`, `useFeatureFlags`, `FeatureFlagsContext`). Consolidation is needed.
See KNOWN_ISSUES.md.

**Decided:** Pre-dates CLAUDE.md system. Phase 4 migration.

---

## D-008 — Mobile-First Design

**Decision:** All UI is designed mobile-first. Bottom navigation bar on mobile,
collapsible sidebar on desktop, responsive Tailwind breakpoints throughout.

**Why:** Target users are mobile-first. Nigerian internet access patterns
strongly favor mobile. The informal commerce channels being displaced (WhatsApp,
Instagram) are primarily mobile.

**Alternative considered:** Desktop-first with mobile adaptation.

**Commitment level:** Fully committed. Not reversible without redesigning the
entire UI.

**Decided:** Pre-dates CLAUDE.md system.

---

## D-009 — Positive-Only Trust Signals in UI

**Decision:** Product cards and seller displays show only positive trust signals
(Verified badge when applicable). Negative labels ("Unverified", "Pending",
"Rejected") are not shown to buyers.

**Why:** Trust-first positioning requires that the platform surface what makes
transactions safer, not amplify uncertainty. Showing "Unverified" under a
product discourages legitimate transactions with legitimate sellers who simply
have not yet gone through verification. Absence of a badge communicates the
same information without the negative framing.

**Alternative considered:** Show all verification states.

**Commitment level:** Committed product decision. Do not reintroduce negative
verification labels in buyer-facing surfaces.

**Decided:** Established during UI fixes, 2026-01 through 2026-05.

---

## D-010 — No AI Attribution in Commits

**Decision:** The Co-Authored-By: Claude attribution line is not used in this
project's commit convention. AI attribution is a deliberate decision with
optics, audit, and consistency implications. It will not be added to one
project without applying it consistently to all projects (Royal Ledger and
ShowMePrice.ng) in a dedicated decision.

**Why:** Attribution conventions have downstream effects on git history, code
review, legal clarity, and team trust. Slipping them in during a setup session
is not the right process.

**Alternative considered:** Standard `Co-Authored-By: Claude <noreply@anthropic.com>`
on all agent-assisted commits.

**Commitment level:** Standing decision until explicitly revisited.

**Decided:** Frankie, 2026-05-11.
