## Root cause

When the buyer applies `FREEFLEA`, `stripe-connect-payment-intent` waives the Secure Checkout Fee and charges Stripe the item + shipping total only ($1.00 in this case). The card is charged successfully.

On the success page, `finalize-checkout` recomputes an expected amount from DB prices **and always adds the 4% + $0.70 fee**, then compares that against what Stripe actually charged:

```
expectedAmountAud = subtotal + secureCheckoutFee   // e.g. 1.00 + 0.74 = 1.74
```

Stripe reports paid = 1.00, so `verifyPayment` throws `Stripe paid amount mismatch: paid 1 expected 1.74`. The client retries 5 times, every attempt fails the same way, then shows the "still syncing your order" screen. Because the exception is thrown before orders are inserted, the listing stays live and the cart is never cleared, which matches exactly what the user saw.

## Fix

Teach `finalize-checkout` about the coupon so its expected amount matches what the payment intent actually charged.

1. **`src/pages/CheckoutSuccess.tsx`** — read `checkout_coupon_code` (persisted at payment-intent creation) from `localStorage` and pass it in the `finalize-checkout` invocation payload as `couponCode`.
2. **`src/pages/Checkout.tsx`** — when the payment intent is created, save the applied `coupon.code` to `localStorage` under `checkout_coupon_code` (and clear it on success cleanup, same list as other `checkout_*` keys).
3. **`supabase/functions/finalize-checkout/index.ts`**:
   - Accept `couponCode` in the request body.
   - Reuse the same normalization + `coupons` table lookup pattern used by `stripe-connect-payment-intent` (service client, uppercase-trim, `active = true`). If a matching coupon is `waive_buyer_fee`, set `secureCheckoutFee = 0` before computing `expectedAmountAud`.
   - Keep the existing tolerance (±$0.05) so nothing else changes.
4. Add the new key to the `localStorage` cleanup arrays in both the demo and success branches of `CheckoutSuccess.tsx`.

## Verification

- Deploy `finalize-checkout`.
- The stuck order for this buyer: since Stripe already captured the $1.00 and no order row exists, run a one-off recovery — hitting Retry on the success screen after the fix (the `checkout_reference` is still in `localStorage`) will now finalize successfully, mark the listing sold, clear the cart, and fire the seller notification. If the buyer has already navigated away and lost localStorage, we manually insert the order server-side using the PaymentIntent id; call that out to the user so they can confirm before we run it.
- Re-test a fresh FREEFLEA checkout end-to-end: card charged for items+shipping only, success dialog shows, cart cleared, listing flips to sold, seller gets "Item Sold" notification.
- Re-test a non-coupon checkout to confirm the strict amount check still catches tampering.

## Notes

- No client-side price trust is added — the coupon is re-validated server-side against the `coupons` table, same as at payment-intent time.
- No change to fee math for non-coupon flows; the 4% + $0.70 buyer fee stays intact.
