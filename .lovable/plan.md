## Plan

1. **Fix the refund backend update**
   - Stop writing `status: "refunded"` to `orders`, because the live database only allows `awaiting`, `shipped`, or `delivered`.
   - Mark refunds using the existing refund fields instead: `refunded_at` and `refund_reason`.
   - Keep the financial refund path unchanged so the payment is still refunded and reversed through the payment processor.

2. **Harden related refund code**
   - Update the automatic 9-day unshipped refund function to use the same safe refund marker.
   - Ensure listing reactivation still only happens for unshipped `awaiting` orders.

3. **Improve error clarity**
   - If an order refund succeeds financially but the local order update fails, return a clear support message instead of a generic function error.
   - Keep the in-app refund confirmation and success/error handling native.

4. **Deploy and verify**
   - Deploy the updated refund functions.
   - Re-check logs for the previous `orders_status_check` error.
   - Confirm the refund endpoint no longer attempts to write an invalid order status.

## Technical note

The failure is not the payment refund itself. The live `orders_status_check` constraint only allows `awaiting`, `shipped`, and `delivered`, while the refund function currently tries to set `status` to `refunded`. The safe fix is to treat refund state as metadata via `refunded_at` rather than adding a new order status in this hot path.