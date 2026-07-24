## Goal

Make the Settings "Seller Dashboard" button show a `Pending` value that equals the Seller Dashboard `Pending` header + `First payout hold`, and confirm the underlying math + fee flow are correct.

## What I found

Verified against `@sarahhearn2`'s live orders:

- 6 awaiting orders totalling **$4.20** gross (item + shipping)
- 1 shipped-not-yet-delivered order totalling **$1.00** gross
- Refunded orders excluded

That matches your report: Pending header $4.20, First-payout hold $1.00.

### Where the numbers come from today

`supabase/functions/stripe-connect-dashboard/index.ts` returns:
- `available`  = raw Stripe `balance.available`
- `pending`   = raw Stripe `balance.pending` (this **already includes** the first-payout-hold sale, because that sale is a Stripe pending payment)
- `unshippedCents` = sum of `orders.status='awaiting'` gross totals
- `availableToWithdraw` = `max(available − unshippedCents, 0)`

`src/pages/SellerDashboard.tsx` then splits `pending` into two visible buckets:
- **First payout hold** = net of the earliest pending Stripe payment (only while `hasPaidPayout` is false)
- **Pending header** = `unshippedRemaining + clearing` (excludes the first-payout-hold amount)

`src/components/PaymentMethodsSection.tsx` currently shows:
- `Available:` = `availableToWithdraw ?? available`
- `Pending:`  = raw `pending` (which does include the hold, but only because hold funds happen to still be in Stripe's pending bucket — it's not the same definition the dashboard header uses, so the number won't always match "dashboard Pending + hold")

### Fee flow (verified, working)

`stripe-connect-payment-intent`:
- Buyer is charged `items + shipping + secureCheckoutFee` (4% + $0.70, waived by `FREEFLEA`).
- Destination charge: `transfer_data.destination = seller`, `on_behalf_of = seller`, `application_fee_amount = secureCheckoutFee`.
- Result: seller nets `items + shipping`; Flea keeps the Secure Checkout Fee; Stripe processing fees are debited from Flea's platform balance out of that fee (destination-charge default). No fee is ever taken from the seller's payout.

This matches the intended model — no change needed.

## Plan

Single-file edit to `src/components/PaymentMethodsSection.tsx` so the button reflects the Seller Dashboard math exactly.

1. In the same `useEffect` that calls `stripe-connect-dashboard`, use the response fields to compute:
   - `availableCents` = `data.availableToWithdraw ?? max(data.available − data.unshippedCents, 0)` (unchanged behaviour, but always derive from `unshippedCents` so the label can't fall back to raw available).
   - `firstHoldCents` = net of the earliest `activity` row where `status='pending'` and `type='payment'`, **only when** `hasPaidPayout` is false — mirrors the dashboard.
   - `dashboardPendingCents` = `data.pending − firstHoldCents` clamped at 0 (the dashboard's Pending header).
   - `settingsPendingCents` = `dashboardPendingCents + firstHoldCents` = effectively `data.pending`, but computed via the same two components so the label is provably "Pending + hold".
2. Render `Available: $X` / `Pending: $Y` using those values.
3. Keep the existing focus refresh so the button stays live.

No backend or fee-flow changes.

## Answering your questions directly

- **Does the math add up?** Yes — for your account: unshipped gross = $4.20, shipped-clearing gross = $1.00, Stripe pending = $5.20. Dashboard splits that into Pending $4.20 + Hold $1.00. After this fix, Settings will show `Pending: $5.20`.
- **Available $3.20 on Settings vs $0 you expect:** that will resolve once the label always derives from `availableToWithdraw` (available − unshipped). If Stripe's `available` legitimately has $3.20 but $4.20 is unshipped, the ring-fence pushes it to $0, which is what you want.
- **Fee flow:** correct as-is. Buyer pays the fee on top, seller nets item + shipping, Flea absorbs Stripe processing fees out of the Secure Checkout Fee.
