# PHASE 1 CHECKPOINT: UI PORT COMPLETE

**Status:** LOCKED
**Date:** Current
**Goal:** Exact replication of static HTML prototype into React + TypeScript.

## 1. Achievements
- Static HTML prototype successfully ported to React 18 structure.
- DOM structure preserved 1:1 (no wrapper divs added).
- Tailwind CSS classes preserved exactly.
- ID attributes preserved exactly for future logic hooks.
- Layout composition created (Navbar + Page + Footer).
- Lucide icons initialized via window global script (as per prototype strategy).

## 2. STRICT REGRESSION RULES (NON-NEGOTIABLE)
Any future changes must adhere to these rules to maintain the "Source of Truth":

1.  **NO CLASS CHANGES:** Do not add, remove, or reorder Tailwind classes.
2.  **NO ID RENAMING:** IDs like `landingView`, `registerModal`, `heroSearchInput` are hard dependencies for logic.
3.  **NO STRUCTURE CHANGES:** Do not add wrapper `<div>`s or logical conditionals that alter the markup hierarchy unless explicitly instructed for specific dynamic features.
4.  **NO AESTHETIC REFACTORS:** The design is final. Do not "improve" the UI.

## 3. Locked File List
The following files represent the UI Source of Truth and should not be modified structurally:

- `src/components/layout/Navbar.tsx`
- `src/pages/HomePage.tsx` (Contains all modal and view markup)
- `src/components/layout/Footer.tsx`
- `src/components/layout/Layout.tsx`
- `src/App.tsx`

## 4. Verification
To verify the state of Phase 1:
1.  Run `npm install`
2.  Run `npm run dev`
3.  Open browser to localhost.
4.  **Check:**
    - Navbar is sticky.
    - Hero section is visible.
    - Footer is present.
    - No React runtime errors in console.
    - Lucide icons render correctly (magnifying glass, user icons, etc.).
