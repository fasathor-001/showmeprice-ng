# ShowMePrice.ng — DB & Feature Flags Reference (VERIFIED)

## Feature Flags (feature_flags.key)
- chat_filtering_enabled
- deals_enabled
- deals_posting_enabled
- delivery_enabled
- escrow_enabled
- in_app_messaging_enabled
- institution_tools_enabled
- phone_call_enabled
- whatsapp_contact_enabled

## public.profiles (key columns)
- id (uuid, PK)
- full_name, display_name, username
- user_type (text, default buyer)
- role (text) -> admin uses role='admin'
- membership_tier (text, default free)
- chats_disabled (boolean, default false)
- plus: notifications booleans, city/state_id/address, phone

## public.businesses (key columns)
- id (uuid, PK)
- user_id (uuid, UNIQUE) -> 0 or 1 business per user
- business_name (text, NOT NULL)
- whatsapp_number, phone_number, city/state_id/address
- verification_tier/status

Seller detection:
- Seller iff businesses row exists for user_id.

## public.products (key columns)
- id (uuid, PK)
- business_id (uuid, NOT NULL, FK businesses.id)
- category_id (int, NOT NULL, FK categories.id)
- title (text, NOT NULL)
- price (numeric, NOT NULL)
- images (text[] default {})
- city/state_id
- is_active (bool default true)
- is_verified (bool default false)
- is_deal (bool default false)
- deal_season (text)

Query patterns:
- Feed: is_active=true order by created_at desc
- MyShop: business_id=<sellerBusinessId> (optionally is_active filter)
- Deals: is_deal=true (and gated by deals_enabled)
