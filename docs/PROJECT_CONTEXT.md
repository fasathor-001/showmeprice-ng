CONTEXT BOOTSTRAP — READ FIRST

I am continuing a long-running project from a previous ChatGPT conversation.

Project:
- Name: ShowMePrice.ng
- Stack: React + Vite + TypeScript + Supabase
- Goal: Nigerian marketplace with verified prices, premium contact reveal, seller dashboards, admin moderation.

Current verified state:
- App runs locally with `npm run dev`
- Blank screen issue resolved by:
  - Removing importmap / esm.sh
  - Using ONLY `/src/main.tsx` as entry
  - Deleting / disabling `index.tsx`
- Supabase env vars are set correctly
- HomePage renders
- Remaining console error was 406 from `businesses` table due to `.single()`

Last fix applied:
- `useSeller.ts` rewritten to use:
  `.select('*').eq('user_id', user.id).limit(1)`
  instead of `.single()`

Current phase:
- Resuming Phase 4: Admin & Feature Toggles rebuild
- Working ONLY in ChatGPT Plus (Gemini abandoned due to preview/CORS issues)

Rules:
- Step-by-step
- No guessing DB fields
- No `.single()` where 0 rows are valid
- Always explain *why* before coding
- PowerShell commands preferred

Acknowledge this context before proceeding.
