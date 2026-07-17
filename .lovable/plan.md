## Root cause of "Order not found."

The seller's **Refund Order** button inside the order chat (`src/pages/OrderChat.tsx`, line ~299) calls `stripe-connect-refund` with `orderId: orderId!` — but the `orderId` route param is actually the **order group id**, not a row id in `public.orders`.

`supabase/functions/stripe-connect-refund/index.ts` looks the record up with `?id=eq.<value>`. When the value is a group id, the row is not found and the function throws `Order not found.` The refund from the Sales Details sheet works because it passes `primaryOrder.id` (a real order row id).

Same problem exists for the reject path — `order-messages?orderId=<groupId>&action=refund_reject|refund_initiate` — and it happens to work only when the server-side handler also accepts a group id.

## What I'll change

### 1. Fix the seller refund button in OrderChat (root cause)
- Resolve a concrete `orders.id` from `orderInfo`/`useOrders()` before calling the refund function. Prefer the specific order that matches `orderId`; fall back to the first order in the group.
- Pass that real order id to `stripe-connect-refund` and to `order-messages` for both `refund_initiate` and `refund_reject`.
- Guard the button: if no order row can be resolved, show a clear toast instead of firing the request.

### 2. Make `stripe-connect-refund` tolerant of a group id (defence in depth)
- If `?id=eq.<value>` returns no row, retry with `?order_group_id=eq.<value>&limit=1`.
- Keep the existing "seller must own it" and "already refunded" checks against the resolved row.
- All refunds still cascade to the whole group via the existing `markRelatedOrdersRefunded` path, so multi-item groups keep refunding atomically.

### 3. Full-flow audit fixes I noticed while reading the code

- **Buyer "Request refund"** (`RefundRequestDialog`) already scopes to a single order id — unchanged.
- **Seller "Reject refund"** in OrderChat: same group-id bug as above; fix alongside (1).
- **Sales Details refund button**: already correct (passes `primaryOrder.id`) — unchanged.
- **Refund status invalidation**: after a successful refund from OrderChat, also invalidate `['orders']`, `['seller-balance']`, and `['order-groups']` so the sheet, seller dashboard activity, and orders list reflect the refund immediately (matches what SalesDetailsSheet already does).
- **Idempotency + double-tap**: keep the existing `flea-refund-${orderId}` idempotency key but derive it from the resolved order id so retries from either surface collapse to one Stripe refund.
- **Rejected message state**: after `refund_reject`, invalidate `['order-messages', orderId]` (already done) and additionally refetch `['refund-status', orderId]` so the buyer sees the "You can escalate" state without needing to reopen the chat.
- **Error surfacing**: `invokeCloudFunction` currently swallows the 400 body in some paths. Route the refund call through a small helper that reads `data.error` from a non-2xx `FunctionsHttpError` and shows it in the toast, so future failures don't come back as the generic "Edge Function returned a non-2xx status code".

### 4. Verification
- Reproduce the failing seller-side "Refund Order" from a refund request in OrderChat against a real test order and confirm success + UI refresh across Sales Details, Seller Dashboard activity, and buyer Notifications.
- Repeat with a multi-item order (group id) to confirm all sibling orders and their listings flip to `refunded`.
- Repeat the Sales Details "Refund" button to confirm no regression.
- Repeat buyer "Request refund" → seller "Reject" to confirm the rejection path posts the system message and the buyer sees the escalation copy.
- Repeat with an already-refunded order and confirm the button no longer appears / errors cleanly.

## Technical details

Files touched:
- `src/pages/OrderChat.tsx` — resolve real `orders.id` from `useOrders` before calling `stripe-connect-refund` and `order-messages`; expand query invalidations; better error toast.
- `supabase/functions/stripe-connect-refund/index.ts` — fallback lookup by `order_group_id` when `id` misses; keep existing group-wide refund cascade.
- (Small) `src/utils/cloudFunctions.ts` helper usage — parse `data.error` from non-2xx responses for surfaced messages. No signature change.

No DB migrations. No changes to buyer refund request flow, Stripe API calls, permissions, or fee handling.