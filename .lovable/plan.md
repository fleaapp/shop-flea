# Allow non-sellers into Offers with a seller-setup prompt

## Goal
Keep the Offers screen fully accessible to users who have not completed seller onboarding, and surface a native "Set up seller account" prompt only under the seller-side toggle area.

## Current state
- `src/pages/Offers.tsx` is not currently wrapped in `useSellerGate`; any user can open it.
- The seller toggle card (`role === 'seller'`) lets any user flip `offers_enabled`, but it is meaningless until the user is a verified seller with active listings.
- `useSellerGate` in `src/hooks/useSellerGate.tsx` already opens `SellerOnboardingSheet` and can be reused for the prompt.

## Changes

### 1. Reuse seller gate inside Offers
- Import `useSellerGate` in `src/pages/Offers.tsx`.
- When `role === 'seller'` and the current user is **not** seller-ready, replace the active `💰 Offers` toggle card with a compact prompt card:
  - Title: "Set up seller account"
  - Subtitle: "Become a seller to receive and manage offers on your listings."
  - Primary button: "Set up seller account" → calls `setSellerGateOpen(true)`.
- Keep the existing toggle card visible only when `sellerReady` is true.
- Render the `gate` sheet from `useSellerGate` at the bottom of the page so the onboarding sheet opens in-app.

### 2. Keep buyer-side offers open to everyone
- Do **not** gate the buyer role toggle, received/sent lists, or the ability to send/counter/accept offers.
- Non-sellers can still:
  - Send buyer-to-seller offers.
  - Receive seller-to-buyer (blast) offers.
  - Accept, decline, counter, and withdraw within the existing rules.

### 3. Optional UX polish
- Disable or hide the seller toggle for non-sellers instead of letting it flip a setting that has no effect.
- Ensure the empty-state copy for the seller role remains accurate for non-sellers (they will see the setup prompt above it).

## Verification
- TypeScript typecheck passes.
- Preview: a non-seller user can open `/offers`, switch to the Seller role, and see the setup prompt.
- Tapping the prompt opens the seller onboarding sheet without leaving the app.
- After onboarding completion, the prompt is replaced by the real `💰 Offers` toggle.
