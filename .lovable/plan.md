## Root cause
Stripe's pending balance transactions report **gross** amounts (item + shipping + Secure Checkout Fee). Flea takes the Secure Checkout Fee via `application_fee_amount`, so the seller's actual pending payout is `amount − fee`, i.e. the `net` field on each balance transaction.

Today the Seller Dashboard uses the gross `amount` for:
- `firstHoldCents` (First payout hold card)
- `pendingCents` derivation via Stripe's raw pending balance (which is also gross for destination-charge flows on the platform view? — no, `balance.pending` on the connected account IS already net of application fees; but the per-row `activity.amount` we display and subtract from is gross)

That mismatch is what makes the amber card read $1.22 when the seller only receives $0.50, and cascades into the Pending header math.

## Fix (single file: `src/pages/SellerDashboard.tsx`, Pending IIFE ~lines 373–498)

Switch every per-transaction figure the UI derives to the **net** field:

1. In the `pendingPayments` mapping, use `a.net` (fallback `a.amount − a.fee`) instead of `a.amount`.
2. `firstHoldCents = firstSale ? Math.max(firstSaleNet, 0) : 0` — amber card now shows the seller-net first payout hold.
3. `stillClearingAmountCents` sums `net` (same fallback) instead of `amount`.
4. Keep `pendingTotal = unshippedRemaining + clearing` as-is — `pendingCents` from `data.pending` is already net, and both subtractions are now in net terms, so the header stays consistent.
5. Combined with the previous plan step, exclude the first-hold group from the "Sales in progress" dropdown so the visible rows sum to the Pending header.

## Out of scope
- No changes to Available card, Instant Payout math, checkout, sale details, or backend. Those already correctly show seller-net (item + shipping).
- No schema or edge-function changes — `net` and `fee` are already returned by `stripe-connect-dashboard`.
