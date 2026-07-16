## Problem

Apple Pay + card options disappear at checkout whenever the per-seller `stripe-connect-status` call in `src/pages/Checkout.tsx` doesn't return `chargesEnabled: true` fast enough (or at all — network hiccup, cold start, self-heal path, etc.). Since listing is already gated on a verified Stripe account, this second check is redundant and is the sole cause of the missing payment methods.

## Fix

Remove the seller payment-status check from checkout entirely. Listing/CreateListing/EditListing remain the single gate for seller verification.

### Changes in `src/pages/Checkout.tsx`

1. Delete `sellerStripeAccounts`, `sellerStripeLoading`, and the `useEffect` that loops `stripe-connect-status` over seller IDs (lines ~117–147).
2. Delete `sellerHasStripe` and `selectedRail` derivations (lines ~179–185). Treat the rail as always `'stripe'`.
3. Fees always compute via `calculateFees(itemsTotal, totalShipping, 'stripe')` — no conditional zeroing.
4. In `handleSubmit`, remove the `if (!sellerHasStripe)` guard (line ~265). Keep the negative-balance and other buyer-side guards.
5. `REVIEWER_USER_ID` / `isReviewer` bypass is no longer needed for this purpose — leave it only if it's used elsewhere in the file; otherwise drop the unused constant.

### Not changing

- `stripe-connect-payment-intent` edge function still validates the seller on the server, so this stays safe if a bad state ever slips through.
- `CreateListing` / `EditListing` continue to require `chargesEnabled` before a listing can exist.
- `PaymentMethodPicker` is untouched — Apple Pay/card render purely from device capability + saved cards.

## Result

Checkout renders Apple Pay + card immediately on load. No dependency on a per-seller status roundtrip. If a listing somehow exists from an unverified seller, the payment-intent function still refuses it server-side.
