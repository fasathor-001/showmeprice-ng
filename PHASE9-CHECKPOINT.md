
# PHASE 9 CHECKPOINT — PREMIUM GATING & ENFORCEMENT

**Status:** LOCKED
**Date:** Current
**Goal:** Implementation of Tier-based Rules, Anti-Leak Messaging, and Listing Limits (No Payments).

## 1. Achievements
- **Tiers Defined:** Updated `Membership` to support 'free', 'pro', 'business'.
- **Limits Enforced:** `useProductSubmission` now checks active product count against `TIER_LIMITS` before inserting.
- **Limit UI:** `PostProductForm` catches `LIMIT_REACHED` error and displays a distinct "Upgrade Membership" prompt.
- **Anti-Leak Chat:** `useMessages` detects 'free' users and redacts phones/emails/links using Regex.
- **Violation Logging:** `useMessages` attempts to insert chat violations into `violation_logs`.
- **Contact Gating:** `useMembership` correctly identifies `isPremium` (Pro/Business) for contact visibility in `ProductDetail`.

## 2. Files Touched
- `src/types.ts`
- `src/constants.ts`
- `src/hooks/useMembership.ts`
- `src/hooks/useMessages.ts`
- `src/hooks/useProductSubmission.ts`
- `src/components/seller/PostProductForm.tsx`

## 3. STRICT LOCK RULES (NON-NEGOTIABLE)
Do NOT modify the following unless resolving a critical crash:
- `src/hooks/useMessages.ts` (Anti-leak logic)
- `src/hooks/useProductSubmission.ts` (Limit checks)

## 4. Allowed Scope for Next Phase
- **Payments:** Integration with Paystack to monetize the now-implemented gates.
- **Admin Dashboard:** UI to view `violation_logs` and approve `verification_tier`.

## 5. Verification
- **Free User Chat:** Send "Call me 08012345678" -> Output "Call me [🔒 Upgrade to share contact]".
- **Pro User Chat:** Send "Call me 08012345678" -> Output "Call me 08012345678".
- **Free Seller Listing:** Post 3 products -> Success. Post 4th -> "Listing Limit Reached" screen.
- **Contact Info:** View product as Free User -> "Upgrade to see contact". View as Pro -> "Call / WhatsApp".
