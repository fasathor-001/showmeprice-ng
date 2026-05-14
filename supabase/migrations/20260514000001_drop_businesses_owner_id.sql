-- Drop the legacy owner_id column from businesses.
-- All code now uses user_id (migrated in Fix 4a, Phase 2).
-- The unique constraint on user_id (businesses_user_id_key) was already
-- in place in production. No backfill needed.
--
-- APPLY ONLY AFTER:
-- 1. Fix 4a (code change) has been verified stable in production
-- 2. Owner confirms no external system (analytics, exports, BI tools)
--    still reads businesses.owner_id
-- 3. Owner has run the FK dependency check (see Phase 2 report Fix 4b)
--
-- Apply via: Supabase Dashboard > SQL Editor > run this file
alter table public.businesses
  drop column if exists owner_id;
