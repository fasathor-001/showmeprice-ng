# AGENTS.md  ShowMePrice.ng (STRICT PRODUCTION RULES)

You are an AI coding agent working in this repo. Follow these rules EXACTLY.

## Prime Directive
- Smallest safe diff that fixes the stated issue.
- No broad refactors. No new features unless explicitly requested.
- Keep UX production-grade.

## Mandatory Workflow
1) Discovery first
2) Plan briefly
3) Apply minimal diff
4) Verify

## PowerShell-only edits
When proposing changes, always provide exact PowerShell commands for:
- timestamped backups
- applying edits

## Supabase / DB Rules (NO EXCEPTIONS)
- NO `.single()` / `.maybeSingle()` unless explicitly approved.
- NO schema assumptions — only use columns verified in DB screenshots or already used in codebase.
- Reads must handle 0 rows safely using `.limit(1)` and `data?.[0] ?? null`.
- Do not weaken RLS or auth.

## VERIFIED DB FACTS

### public.profiles (CONFIRMED)
Columns:
- id uuid PK
- full_name, display_name, username text nullable
- user_type text NOT NULL default 'buyer'
- role text nullable
- membership_tier text default 'free'
- chats_disabled boolean default false
- plus: phone, city, state_id, address, business_name, business_type, language, notification prefs

Implications:
- Buyer naming can rely on: full_name -> display_name -> username.
- Admin detection can rely on: profiles.role === 'admin'.
- Chat gating can rely on: profiles.chats_disabled.

### public.businesses (CONFIRMED)
- id uuid PK default uuid_generate_v4()
- user_id uuid NOT NULL UNIQUE (0 or 1 business per user)
- business_name text NOT NULL
- business_type, description text nullable
- verification_tier seller_tier default 'basic'
- verification_status verification_status default 'none'
- state_id int FK -> states.id
- city, address, whatsapp_number, phone_number, links text nullable
- total_views int default 0
- whatsapp_clicks int default 0
- created_at/updated_at timestamptz default now()

Implication:
- A user is a seller account if and only if a row exists in businesses for that user_id.
- Seller display name should prefer businesses.business_name.

### public.products (CONFIRMED)
Columns:
- id uuid PK default uuid_generate_v4()
- business_id uuid NOT NULL FK -> businesses.id
- category_id int NOT NULL FK -> categories.id
- state_id int nullable FK -> states.id
- title text NOT NULL
- description text nullable
- price numeric NOT NULL
- original_price numeric nullable
- condition product_condition default 'new'
- images text[] default '{}'::text[]
- city text nullable
- is_active boolean default true
- is_verified boolean default false
- view_count int default 0
- created_at/updated_at timestamptz default now()
- is_deal boolean NOT NULL default false
- deal_season text nullable

Indexes present:
- idx_products_is_active_created_at (feed queries)
- idx_products_business_active (my shop queries)
- idx_products_category_id, idx_products_state_id, products_is_deal_idx

Implications:
- My Shop must query by products.business_id (not profiles.user_id).
- Marketplace feed should filter is_active=true and order by created_at desc.
- Deals data is products.is_deal + products.deal_season.

## Feature Flags (VERIFIED KEYS)
Canonical keys in feature_flags.key:
- chat_filtering_enabled
- deals_enabled
- deals_posting_enabled
- delivery_enabled
- escrow_enabled
- in_app_messaging_enabled
- institution_tools_enabled
- phone_call_enabled
- whatsapp_contact_enabled

Mapping guidance:
- deals_enabled => buyer-side visibility of products where is_deal=true (and Deals UI sections)
- deals_posting_enabled => seller ability to create products with is_deal=true and show season badge text
- in_app_messaging_enabled => enable Inbox + message entry points
- whatsapp_contact_enabled / phone_call_enabled => contact reveal buttons
- chat_filtering_enabled => chat policy checks (contact leak)
- delivery_enabled / escrow_enabled / institution_tools_enabled => gate those pages/CTAs

Rules:
- Use these keys exactly; do not invent keys.
- Default behavior must be safe if flags cannot be loaded.

## Routing Architecture (Project-Specific)
- Custom navigation via window.history.pushState + internal switching.
- Do NOT add react-router unless explicitly requested.
- After navigation changes, dispatch window.dispatchEvent(new Event("smp:navigate")) if needed.

## Messaging / Inbox UX Rules (TAILORED)
- Never show Unknown user if a real name exists.
- Partner naming precedence for conversation labels:
  1) If partner has a businesses row with non-empty business_name -> use it
  2) Else use profiles.full_name (if non-empty)
  3) Else profiles.display_name (if non-empty)
  4) Else profiles.username (if non-empty)
  5) Else deterministic fallback:
     - If current user is seller: Buyer <shortId>
     - If current user is buyer: Seller <shortId>
- Never allow the literal string "Unknown user" (case-insensitive) to overwrite a valid name.

## UI/UX Standards
- Buttons must route correctly for buyer vs seller.
- Fix text encoding issues (mojibake), e.g. Loadingâ€¦ -> Loading, donâ€t -> don’t.

## Required Validation Before Finishing
- npm run build
- npm run lint (if present)
- Smoke tests:
  - Buyer: Inbox names + Back to Dashboard correct
  - Seller: Inbox names + Back to My Shop correct
  - Send buyer->seller and seller->buyer; messages appear; unread updates
