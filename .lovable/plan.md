## Problem

For `@sarahhearn2`, the Seller Dashboard shows:

- **Pending: $4.20** (correct — matches Stripe pending net)
- **Sales in progress (3):** Bundle $1.35 + Test $0.50 + Test $1.00 = **$2.85**
- **First payout hold: $1.00**

The DB actually has **4 active (awaiting/shipped, non-refunded) order groups** totalling **$4.20 gross**:

| Group | Title | Gross |
| --- | --- | --- |
| 51760309 | Bundle (Test 5 + Test 2) | $1.35 |
| 4f47a4a9 | Bundle (Denim + Jacket) | $1.35 |
| 44753b5d | Test | $0.50 |
| d3f66e20 | Test | $1.00 |

So one bundle ($1.35) is missing from the list.

## Root cause

In `src/pages/SellerDashboard.tsx` (~lines 405–423), `firstHoldGroupId` is computed as *"the oldest awaiting/shipped seller order group"* whenever `firstHoldCents > 0`, and that group is then filtered out of `activeGroups` to avoid double-counting against the First payout hold card.

But the Stripe first-hold payment doesn't necessarily correspond to an awaiting/shipped group at all. In this account the $1.00 first-hold actually maps to the already-**delivered** order `597d2f19` ($0.50 + $0.50). The code still picks the oldest awaiting bundle (`51760309`, $1.35) and hides it, leaving 3 rows summing $2.85 instead of 4 rows summing $4.20.

There is no `payment_intent_id`/metadata link in the dashboard payload today, so we can't reliably match the Stripe first-sale payment back to a specific order group from the client.

## Fix

Stop hiding any group from "Sales in progress" based on the fragile "oldest awaiting" heuristic. Show **all** non-refunded awaiting/shipped groups.

Concretely in `src/pages/SellerDashboard.tsx`:

1. Remove the `firstHoldGroupId` computation block (lines ~405–411).
2. Remove the `if (firstHoldGroupId && g.id === firstHoldGroupId) return false;` line from the `activeGroups` filter (~line 422).
3. Keep the header total (`pendingTotal = unshippedRemaining + clearing`) unchanged — it already correctly subtracts `firstHoldCents` from Stripe pending, so it stays at $4.20 net when the first-hold sale is already delivered, and stays consistent when the first-hold sale is still awaiting (the per-row list is gross-per-order, header is net-of-fees; a small visual mismatch between the two is expected and preferable to hiding real orders).

## Verification

After the change, `@sarahhearn2`'s dashboard should show:

- Pending: **$4.20** (unchanged)
- Sales in progress **(4)**: Bundle $1.35, Bundle $1.35, Test $0.50, Test $1.00
- First payout hold: $1.00 (unchanged)

No backend or schema changes required. Scope is limited to `src/pages/SellerDashboard.tsx`.
