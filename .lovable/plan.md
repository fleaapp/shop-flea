## Plan

1. **Fix the refund backend failure**
   - Update `stripe-connect-refund` so missing optional order fields are retried one at a time, including `checkout_reference` and `payment_method`.
   - Return the real backend error message to the app instead of the generic non-2xx failure.

2. **Support both current payment paths**
   - If an order has a Checkout Session reference (`cs_...`), resolve it to the payment intent as it does now.
   - If an order has a PaymentIntent reference (`pi_...`), refund it directly.
   - If the order is missing a stored reference, look up the payment intent from payment records or provider metadata where available, rather than crashing on the missing column.

3. **Keep refunds fully in-app**
   - Keep the native confirmation flow on Sale details.
   - On success, update the order as refunded, reactivate the listing if needed, refresh seller balance and sales data, and show an in-app success message.

4. **Harden related auto-refund code**
   - Apply the same PaymentIntent-aware refund logic to the 9-day unshipped auto-refund function so it does not fail for native checkout orders.

5. **Verify the fix**
   - Deploy the changed functions.
   - Test the refund function against the failing order path and confirm it returns a successful response or a clear actionable message if the payment provider rejects the refund.

## Technical notes

- The current live logs show the failure is caused by the refund function selecting `orders.checkout_reference` on a schema path that still reports that column as unavailable.
- The checkout flow now stores native checkout references as PaymentIntent IDs, so refund code must handle `pi_...` directly and not assume every order uses a hosted checkout session.