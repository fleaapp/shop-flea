# The missing $0.50 in Pending

## What I found

I pulled the actual orders and traced the dashboard maths. Nothing is lost - the $0.50 is real money, it just has no row.

Only one order is currently held for @sarahhearn2:

| Order | Item | Sale total | Transaction fee | You receive |
|---|---|---|---|---|
| Dress | awaiting shipment | $4.25 | $0.59 | $3.66 |

The other $0.50 comes from a different bucket. A "Test" sale ($0.50 + $0.50 shipping) was delivered and auto-completed earlier today. Once an order completes, it drops out of the held list - but the cash itself is still moving through the payment provider and has not landed in Available yet. That in-transit amount is counted in the Pending header, and it is exactly the $0.50 gap.

So the header is right ($4.16) and the row is right ($3.66); what is missing is a row for the money that is clearing at the payment provider.

A second, smaller inconsistency follows from this: the "Sale total $4.25 - fees $0.59 = $3.66 to you." line under the header only describes the held orders, so it visibly disagrees with the $4.16 above it.

## Fixes

### 1. Show the clearing money as its own row
Add a row inside "Sales in progress" (renamed "Pending funds") for the amount clearing at the payment provider, labelled "Clearing from completed sales" with its release date. Count it in the row count so the rows always add up to the header total.

### 2. Make the breakdown line match the header
The "Sale total - fees = to you" line becomes a breakdown of the whole Pending figure: held sales net, plus the clearing amount, equals the header. If there is nothing clearing, the line reads exactly as it does today.

### 3. Guarantee rows equal header
Add a safety net: if the sum of the listed rows is still short of the header for any reason, the difference is rendered as a single "Other funds clearing" row rather than silently vanishing. No number in this panel can be unaccounted for again.

## Audit of the rest of the pay flow (checked, no change needed)

- Held rule: awaiting, shipped, delivered inside the 48-hour window, or refund requested - matches the payout guard exactly.
- Held amounts are net of the seller Transaction Fee, and already fall back to delivery + 48 hours when the protection window date is missing, so an order cannot freeze funds forever.
- Available to withdraw = payment provider available minus held, floored at zero. Instant payout uses the same subtraction.
- Completed and refunded orders are excluded from held, and refunded orders reverse their transfer, so nothing is double counted.
- Fee snapshot per order (`transaction_fee`) is what both the row and the Sale details drawer read, so those two surfaces agree.

## Technical notes

- `src/pages/SellerDashboard.tsx` only - the Pending panel block. Add a synthetic row for `clearing` cents (and a residual row for `pendingTotal - sum(rows)` when positive), and recompute the fee summary line from the header total rather than only `heldGroups`.
- Release date for the clearing row comes from the existing `earliestClearing` value.
- No backend, edge function, or fee-calculation changes.
