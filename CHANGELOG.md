# CHANGELOG — ShowMePrice.ng

Most recent entry first.

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
