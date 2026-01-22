# PHASE 8 CHECKPOINT — USER & BUSINESS SETTINGS

**Status:** LOCKED
**Date:** Current
**Goal:** Allow users to update personal and business profile details.

## 1. Achievements
- **Data Types:** Added `UserProfile` to `types.ts`.
- **Data Hooks:** `useProfile` handles fetching and updating `profiles` and `businesses` tables.
- **UI Implementation:** `ProfilePage.tsx` provides a tabbed interface for Personal vs Business settings.
- **Integration:** 
  - `HomePage` now handles `profile` view mode.
  - `Navbar` includes a link to "Profile Settings" in the user dropdown.
- **Robustness:** Handles missing profiles (new users) by defaulting to auth metadata.

## 2. Files Touched
- `src/types.ts`
- `src/hooks/useProfile.ts` (New)
- `src/pages/ProfilePage.tsx` (New)
- `src/pages/HomePage.tsx` (Added Profile View)
- `src/components/layout/Navbar.tsx` (Added Settings Link)

## 3. STRICT LOCK RULES (NON-NEGOTIABLE)
Do NOT modify the following unless resolving a critical crash:
- `src/hooks/useProfile.ts`
- `src/pages/ProfilePage.tsx`

## 4. Allowed Scope for Next Phase
- **Real Payments:** Integration with Paystack/Flutterwave (Currently mocked in Phase 7).
- **Admin Dashboard:** For approving sellers (verification_tier).
- **Messaging System:** Real-time chat (Currently mocked alerts).

## 5. Verification
- Log in.
- Click User Menu -> Profile Settings.
- Edit Name/Phone -> Save -> Refresh -> Data persists.
- If Seller: Switch to Business Tab -> Edit Business Name/City -> Save -> Data persists.
