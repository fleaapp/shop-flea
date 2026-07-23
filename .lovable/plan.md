## Concept

Each dollar of the seller's Stripe balance lands in exactly one row:

- **Held for unshipped** — sales from orders the seller hasn't shipped yet (regardless of whether Stripe still has the money in Pending or already moved it to Available).
- **Clearing** — shipped sales still in Stripe's Pending bucket, waiting to clear the card network.
- **First payout hold** — the first sale, held under Stripe's one-off new-account security review (only until the first payout has ever been marked paid).
- **Available** — shipped sales that have cleared. This is the withdrawable number.

Sum of the four rows equals total Stripe balance, no double-counting.

## Implementation (`src/pages/SellerDashboard.tsx`, UI-only)

We already have on the client:
- `available` (Stripe available cents)
- `pending` (Stripe pending cents)
- `unshippedCents` (from the orders table, total value of unshipped orders)
- `activity[]` with per-item `status` and `available_on`
- `payouts[]` for `hasPaidPayout`

Split the unshipped dollars across the Stripe buckets with a simple deterministic rule (matches the existing `availableToWithdraw = max(available − unshipped, 0)` model, so no backend change needed):

```text
unshippedInAvailable = min(unshippedCents, available)
unshippedInPending   = max(unshippedCents − available, 0)

heldForUnshipped     = unshippedCents
clearingRaw          = max(pending − unshippedInPending, 0)
firstHoldCents       = (hasPaidPayout || clearingRaw === 0) ? 0
                      : earliest pending activity item's amount, capped at clearingRaw
clearing             = clearingRaw − firstHoldCents
availableToWithdraw  = max(available − unshippedInAvailable, 0)   // unchanged
```

Render order stays: **Held for unshipped → Clearing → First payout hold → Available.**

## Visibility rules

- Held for unshipped: show whenever `unshippedCents > 0` (drop the current `available > 0` gate).
- Clearing: show when `clearing > 0`, with `Ready {fmtDate(earliestClearing)}.` from the earliest non-first-hold pending activity item.
- First payout hold: show when `firstHoldCents > 0`. Copy unchanged: "Usually within 7 days."
- Available: always shown (or Balance owed if negative), unchanged styling.

## Edge cases handled

- Only unshipped orders, nothing cleared → Held row shows the full amount, Clearing and First-hold hidden, Available = $0.
- First sale still pending and unshipped → the unshipped subtraction absorbs it first, so it appears in Held (not First-hold) — which matches the model since it's not really "waiting on Stripe", the seller just hasn't shipped.
- After first payout paid → First-hold row disappears permanently; all remaining pending shows as Clearing.

## Out of scope

No backend/edge changes. No changes to payout gating, coupons, or activity list.
