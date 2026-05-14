# Production Verification Audit — 2026-05-14

Pre-launch checkpoint. Six questions raised by Phase 0 discovery.

---

## 1. chat_filter Edge Function deployed?

Status: NO (not in local repo) — CANNOT VERIFY production deployment

Evidence: `supabase/functions/` directory was audited. Present functions include
`notify`, `escrow_actions`, `escrow-init`, `escrow-expire`, `escrow-verify`,
`paystack-webhook`, `offer_create`, `offer_action`, `offer_payment_init`,
`payments_init`, `resolve-bank-account`, `revoke-admin`, `invite-admin`,
`approve-seller`, `create_escrow_order`, `verify_escrow_status`, `init-escrow-payment`.
No `chat_filter` function exists in the repo.

`src/pages/InboxPage.tsx` calls `invokeAuthedFunction("chat_filter", ...)` when
the `chat_filtering_enabled` feature flag is on.

Action needed: OWNER ACTION REQUIRED.
- Check whether `chat_filtering_enabled` is currently ON in production:
  In Supabase SQL editor: `SELECT key, enabled FROM feature_flags WHERE key = 'chat_filtering_enabled';`
- If ON: the function call will 404 and silently fail message send. Turn the flag
  OFF until the function is created, or create the function.
- If OFF (expected): no immediate impact. Leave flag OFF until function is written.
  See KNOWN_ISSUES.md #13.

---

## 2. RESEND_API_KEY set in production?

Status: CANNOT VERIFY — requires Supabase dashboard access

Evidence: `supabase/functions/notify/index.ts` reads `Deno.env.get("RESEND_API_KEY")`.
If absent, it logs a warning and returns `{ ok: true, skipped: true }` — a
deliberate silent no-op. The local `supabase/functions/.env` file exists but was
not read (it may contain the key for local dev only). The key was not found in
`.env.local` or `.env.local.bak`.

Action needed: OWNER ACTION REQUIRED.
- In Supabase Dashboard → Edge Functions → Environment Variables: verify
  `RESEND_API_KEY` is present.
- If absent: transactional emails (escrow confirmations, seller approvals) are
  silently not sending. Add the key from your Resend dashboard.
- To confirm email is working: check the `notify` edge function logs in Supabase
  Dashboard → Edge Functions → notify → Logs for `skipped: true` entries.

---

## 3. pg_cron escrow expiry job running?

Status: CANNOT VERIFY — requires Supabase dashboard access

Evidence: Migration `20260504000002_escrow_auto_release.sql` defines
`expire_stale_escrow_orders(cutoff_minutes int default 30)` and includes a
comment: "Run this manually in the SQL editor once pg_cron is enabled".
The commented-out SQL:

```sql
select cron.schedule(
  'expire-stale-escrow',
  '*/30 * * * *',
  $$
    select expire_stale_escrow_orders(30);
  $$
);
```

This is NOT executed by the migration — it is a comment with instructions.
Whether it was run manually is unknown.

Action needed: OWNER ACTION REQUIRED.
- In Supabase Dashboard → SQL Editor, run:
  `SELECT * FROM cron.job WHERE jobname = 'expire-stale-escrow';`
- If no rows: the job is not running. Run the cron.schedule SQL above to
  activate it. Requires pg_cron extension to be enabled first:
  Dashboard → Database → Extensions → pg_cron → Enable.
- If rows present: confirm `active = true`.
- If not running: stale `pending_payment` escrow orders accumulate
  indefinitely. See KNOWN_ISSUES.md #14.

---

## 4. owner_id → user_id migration applied?

Status: CANNOT VERIFY production — local migration files present

Evidence: Migration `20260121014100_businesses_seller_profile_compat.sql`
adds `user_id` column and backfills from `owner_id`. Migration
`20260121016000_businesses_owner_id_autofill.sql` adds a trigger keeping
both columns in sync. Migration `20260121015000_businesses_unique_user_id.sql`
adds a unique constraint on `user_id`. All three files exist in
`supabase/migrations/` and are dated January 2026.

The one-time data migration mentioned in KNOWN_ISSUES.md #16 —
`UPDATE businesses SET user_id = owner_id WHERE user_id IS NULL` — appears
to be executed inside `20260121014100_businesses_seller_profile_compat.sql`
(line: `update public.businesses set user_id = owner_id where user_id is null`).

Action needed: LOW PRIORITY.
- Confirm migration was applied to production:
  `SELECT column_name FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'user_id';`
- If column exists: migration applied. Code fallback paths (useSeller.ts,
  useProfile.ts) remain harmless.
- If column does not exist: migration was never applied — seller profile
  setup and business lookup will fail for any seller whose record only has
  `owner_id`. Apply migration immediately.

---

## 5. May 2026 migrations applied?

Status: CANNOT VERIFY production — files exist locally

Evidence: Two May 2026 migrations exist in `supabase/migrations/`:
- `20260504000001_seller_bank_accounts.sql` — adds `seller_bank_accounts`
  table with RLS policies for seller bank account storage (used for
  settlement payouts).
- `20260504000002_escrow_auto_release.sql` — redefines
  `expire_stale_escrow_orders()` function (fixes schema) and documents
  the pg_cron schedule (see item 3 above).

Prior migration drift has occurred on this project (see CLAUDE.md).

Action needed: OWNER ACTION REQUIRED.
- In Supabase Dashboard → SQL Editor, check if both tables/functions exist:
  `SELECT to_regclass('public.seller_bank_accounts');`
  `SELECT proname FROM pg_proc WHERE proname = 'expire_stale_escrow_orders';`
- If `seller_bank_accounts` is NULL: `20260504000001` was not applied.
  Apply via Supabase CLI: `supabase db push` — or paste the migration SQL
  directly in the SQL Editor.
- If `expire_stale_escrow_orders` is missing: apply `20260504000002`.
- If both exist: migrations are applied. Verify schema version via
  `supabase migration list` against the Supabase remote.

---

## 6. Paystack key is production (not test)?

Status: CANNOT VERIFY — key not in local env files

Evidence: `VITE_PAYSTACK_PUBLIC_KEY` is read in `src/hooks/usePayment.ts` and
`src/pages/PricingPage.tsx`. The key is NOT present in `.env.local` (only
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set there). `.env.local.bak`
also lacks the key. The key is likely set as a Cloudflare Pages environment
variable.

Paystack public keys follow the format: `pk_live_...` (production) or
`pk_test_...` (test). Test keys do not process real payments.

Action needed: OWNER ACTION REQUIRED.
- In Cloudflare Pages Dashboard → showmeprice-ng → Settings → Environment
  Variables: locate `VITE_PAYSTACK_PUBLIC_KEY`.
- Check the prefix: `pk_live_` = production (correct), `pk_test_` = test mode
  (buyers cannot pay with real cards — all transactions are test transactions).
- DO NOT paste the full key in any issue tracker or chat. Check the prefix only.
- If test key: replace with the `pk_live_` key from your Paystack dashboard
  before accepting real payments.

---

## Summary

- Green (verified from local repo): 1
  - Notify function has RESEND_API_KEY guard (graceful no-op if missing — won't crash)

- Red / Needs owner action: 3
  - `chat_filter` function does not exist in repo (verify flag is OFF) — HIGH
  - Paystack key prefix unknown (must be `pk_live_` before launch) — CRITICAL
  - May 2026 migrations: unknown if applied to production — HIGH

- Cannot verify without dashboard access: 4
  - RESEND_API_KEY in Supabase Edge Function secrets
  - pg_cron escrow expiry job scheduled and active
  - May 2026 migrations applied to production DB
  - Paystack key prefix (live vs test)

Recommended launch order: (1) Confirm Paystack key is live, (2) Apply any
missing migrations, (3) Verify RESEND_API_KEY is set, (4) Confirm chat_filter
flag is OFF or build the function.
