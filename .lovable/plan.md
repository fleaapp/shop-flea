## Issue
The payment refund is succeeding, but the app cannot mark the order as refunded afterward. The live database does have `orders.refunded_at`, so the current failure is caused by the refund function using the REST schema cache path, which is still returning “column missing” for `refunded_at` even after a reload attempt.

## Plan
1. **Replace the fragile order update path**
   - In `stripe-connect-refund`, stop relying on the cached REST update for `orders.refunded_at`.
   - Add a small database function that marks an order or order group as refunded using direct database SQL.
   - Call that database function from the refund edge function after the financial refund succeeds.

2. **Keep the refund status model unchanged**
   - Keep `status` limited to `awaiting`, `shipped`, and `delivered`.
   - Keep `refunded_at` and `refund_reason` as the refund source of truth.
   - Do not reintroduce `status = refunded`.

3. **Make auto-refunds use the same safe path**
   - Update the 9-day unshipped refund function to mark refunds through the same database function, so it does not hit the same schema-cache issue later.

4. **Improve failure handling**
   - If the financial refund already exists because of retry/idempotency, still retry marking the order refunded instead of failing the whole flow.
   - Log the exact database marking error internally, but keep the user-facing message clear.

5. **Deploy and verify**
   - Deploy the updated refund functions.
   - Confirm the live `orders` table still has `refunded_at` and `refund_reason`.
   - Check function logs to confirm the refund function no longer attempts to patch `refunded_at` through the stale REST cache.

## Technical details
- New backend RPC: `mark_order_refunded(p_order_id uuid, p_order_group_id uuid, p_refund_reason text)`.
- The function will update `refunded_at`, `refund_reason`, and `updated_at` directly on `public.orders`.
- Access will be service-role only from edge functions, not callable by normal users from the client.