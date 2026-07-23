## Fix

`src/pages/SellerDashboard.tsx` — change the allocation order so the first sale's true amount is shown before unshipped subtraction eats into it.

### New allocation

```text
// 1. Identify the actual first sale (earliest by created timestamp) among pending payments
pendingPayments = activity.filter(a => a.status === 'pending' && a.type === 'payment')
                          .sort((a, b) => a.created - b.created)   // ascending by creation date
firstSale       = !hasPaidPayout ? pendingPayments[0] : null
firstHoldCents  = firstSale ? max(firstSale.amount, 0) : 0

// 2. Assume the first sale is also the first unshipped order (chronologically it almost always is);
//    so subtract it from unshipped before splitting the rest across the Stripe buckets
unshippedRemaining   = max(unshippedCents - firstHoldCents, 0)
unshippedInAvailable = min(unshippedRemaining, available)
unshippedInPending   = max(unshippedRemaining - available, 0)

// 3. Remaining pending goes to Clearing
clearing             = max(pending - firstHoldCents - unshippedInPending, 0)

// 4. Withdrawable unchanged
availableToWithdraw  = max(available - unshippedInAvailable, 0)
```

### Ready-date for Clearing

Compute `earliestClearing` from the remaining pending activity (drop the first-sale item), unchanged in spirit — just sourced from the corrected list.

### Numbers on Sarah's account

- First payout hold: $1.35 (was $1.00)
- Held for unshipped: $1.85 (was $3.20)
- Clearing from recent sales: $1.00 (was $0.00)
- Available: $0.00

Sum = $4.20 = Stripe pending, still reconciles.

### Edge cases

- If the first sale is fully shipped and hasn't cleared yet, subtracting it from unshipped correctly leaves unshipped at its full value; clearing absorbs the remainder.
- If `hasPaidPayout` is true, First payout hold hides and everything collapses to Held / Clearing / Available.
- If there are no pending payments at all, first-hold is $0 and behaviour matches today.

### Out of scope

No backend changes, no copy changes, no reordering of rows.
