# Let non-sellers open the Offers screen

The Offers screen itself was already updated to show a "Set up seller account" prompt under the Seller toggle. The problem is upstream: the two buttons that open Offers still block non-sellers before navigation happens, so the onboarding sheet opens instead of the screen.

## What's blocking it

- **Settings > Seller > Offers**: only navigates when the user is seller-ready; otherwise it opens the seller onboarding sheet.
- **Profile 💰 Offers button**: only navigates when a payment method exists; otherwise it opens the payment gate sheet.

## Changes

1. **Settings (`src/pages/Offers` entry in `src/pages/Settings.tsx`)** - always navigate to `/offers`. Pass `role: 'seller'` when the user is seller-ready, otherwise `role: 'buyer'` so a non-seller lands on their own offers first and can switch to Seller to see the setup prompt. Guests keep the existing sign-in prompt.
2. **Profile (`src/pages/Profile.tsx`)** - remove the payment-method gate on the 💰 button; always navigate to `/offers`, with the same seller/buyer default role.
3. Leave the Offers screen, `useSellerGate`, and all other seller-gated actions (creating listings, bundle offers, payouts) exactly as they are - the gate still applies where it should.

## Technical notes

- No backend or RLS changes; this is navigation-only.
- Seller readiness is already available on both pages via `useSellerGate`, so the default-role logic reuses `sellerReady`.
