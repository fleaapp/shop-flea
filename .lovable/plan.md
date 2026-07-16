## Problem

The refund edge function is returning 500 because the `orders` table on the source database no longer has a `payment_method` column. The network log confirms this — the same column is failing every front-end query too:

```
GET /rest/v1/orders?...payment_method... → 400
{"code":"42703","message":"column orders.payment_method does not exist"}
```

Inside `supabase/functions/stripe-connect-refund/index.ts`, line 67 selects `payment_method` from `orders`. PostgREST returns a 400 error object (not an array), so `orders?.[0]` is `undefined`, we throw `"Order not found"`, and the client sees `FunctionsHttpError: Edge Function returned a non-2xx status code`.

Same root cause is breaking:
- Seller/buyer sale-count badges (`src/hooks/useNavBadges.ts`)
- The order list hook (`src/hooks/useOrders.ts`)

## Fix

Apply the schema-resilient pattern we already use in `order-messages` (retry the select without the missing column, then default `payment_method` to `"stripe"` in memory).

### 1. `supabase/functions/stripe-connect-refund/index.ts`
- Extract the order fetch into a small helper that first queries with `payment_method`, and on a 42703 / "column ... does not exist" error, retries the same query without it and treats `payment_method` as `"stripe"`.
- Everything downstream (`order.payment_method === 'demo'`, the stripe-only guard) keeps working unchanged.
- Also improve the error response: if the order fetch itself returns a non-2xx from PostgREST, return a clear message ("Could not load order") instead of the generic "Order not found", so future schema drift is obvious in logs.

### 2. `src/hooks/useNavBadges.ts`
- Same pattern: try the select with `payment_method`; if it returns the 42703 error, retry without it and treat every row as non-demo (i.e. `payment_method: 'stripe'`). This unblocks the Sales badge that's currently silently failing.

### 3. `src/hooks/useOrders.ts`
- Wrap the orders select in the same retry-without-column helper so buyer/seller order lists load again.

No schema migration — the column is intentionally gone on that database, and we already have a resilient path elsewhere. This just extends it to the three remaining call sites.

## Verification

- Redeploy `stripe-connect-refund`, then retry the refund from Sale details. Expect `{ success: true, refundId, status }`.
- Check the Sales badge and Orders list re-populate for `@jcsbh` and `@sarahhearn2` without 400s in the network tab.
- Confirm demo orders (App Review) still short-circuit correctly — since fallback treats missing column as `"stripe"`, real demo orders written with `payment_method: 'demo'` will still be detected because the column exists on inserts through `finalize-checkout` (which has its own fallback). If the column truly no longer exists, demo orders will refund via Stripe, which is fine because they're only created when the column is writable.
