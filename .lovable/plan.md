# Fix: "One or more item IDs are invalid" at wallet-init

## What's happening

Checkout fails before the Apple Pay sheet even opens. The app asks the backend to create the payment, and the backend rejects the request as invalid - so the error is not about Apple Pay, the buyer, or the seller. Any payment method on the current build hits the same wall.

## Why it broke after working

The seller-ID check was added to the payment function during the recent payments/security hardening pass. The checkout screen was never updated to send that field, so the guard rejects every request. Nothing about Apple Pay or the Stripe setup changed - this is a payload mismatch introduced by the newer guard.


The payment-intent function validates every cart item and requires both an item ID **and** a seller ID:

```text
supabase/functions/stripe-connect-payment-intent/index.ts (line 80-84)
  if (!isUuid(item?.id) || !isUuid(item?.sellerId)) -> 400 invalid_item_id
```

The checkout screen only sends four fields per item and omits `sellerId`:

```text
src/pages/Checkout.tsx (line 289)
  items: validItems.map(item => ({ id, title, price, image }))
```

So `item.sellerId` is always `undefined` and every request is rejected.

## Fix

1. **Client** - include `sellerId: item.sellerId` in the items array sent to `stripe-connect-payment-intent`.
2. **Server** - make the seller ID check tolerant: validate it only when it is present, and keep rejecting a malformed value. The function already derives the real seller from the listings table, so the client value is not trusted either way. This matters because the TestFlight binary already in testers' hands sends the old payload - the server fix unblocks that build immediately, without waiting for a new release.
3. Re-check the same payload shape used by the saved-card and new-card paths so all three methods go through the corrected call.
4. Deploy the updated function, then retest: Apple Pay, new card, saved card, and a bundle of two items from the same seller.

## Notes

No database or fee-logic changes. Item pricing, offers, bundle discounts, and coupons stay server-authoritative.
