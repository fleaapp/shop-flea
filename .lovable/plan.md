## Goal

Fix two problems on the Seller Dashboard without double-counting balances or promising timing windows we can't guarantee.

1. The $1 shipped sale looks missing because it's silently inside Stripe's Pending bucket with no row of its own.
2. The current copy invents "24 hours" / "7 days" timing instead of using the real release date Stripe already tells us.

## What the user will see

**Available to withdraw** stays as the headline number (unchanged math).

Under it, rows appear conditionally so the numbers always add up to what's actually in the account:

- **Clearing from recent sales** — shown when Stripe's `pending > 0`. Amount = `pending` (e.g. $4.20). Underneath: "Ready [date]" pulled from the earliest `available_on` in the pending balance transactions Stripe already returns. This is the row that surfaces the $1 (and every future in-flight sale). No mention of shipped vs unshipped.
- **Held for unshipped orders** — shown only when `available > 0 AND unshippedCents > 0`, i.e. once Stripe has released funds and Flea is now the one ring-fencing them. This prevents the row from being added on top of Clearing (which would look like $7.40 when the account only holds $4.20). Copy unchanged: "Ship orders with tracking to release these funds."
- **First payout hold** banner — same visibility rule as today (`!hasPaidPayout && pending > 0`), using the same real `available_on` date. No invented 7-day copy.

Under the payout buttons, the "Please note" panel is rewritten so nothing states a fixed hour or day window:

- You must add valid tracking for your funds to become available. (unchanged)
- Your first payout may take longer while our payment processor completes a one-off security check on new accounts. The exact release date is shown above once Stripe confirms it.
- After that, each sale clears on the payment processor's schedule, then standard payout takes 1 to 2 business days to reach your bank.
- Need it faster? Instant Payout (about 30 minutes) for a 1.5% fee.

No "24 hours", no "48 hours", no "7 to 14 days" hard promise anywhere. The concrete date is always the real `available_on` from Stripe.

## Why this stops looking like $7.40

Stripe returns one truth: `available + pending = total funds in the account`. The unshipped ring-fence only reduces what's withdrawable from `available`, not from `pending`. So:

- While balance is $0 available / $4.20 pending → show only Clearing $4.20. Total reads correctly as $4.20.
- Once Stripe moves it → $4.20 available / $0 pending → Clearing row disappears, Held-for-unshipped $3.20 appears, Available to withdraw shows $1.00. Total still reads correctly as $4.20.

## Technical details

- **Data source:** `stripe-connect-dashboard` already returns everything needed (`available`, `pending`, `unshippedCents`, `activity[]` with `status` and `available_on`, `payouts[]`). No backend change.
- **Clearing row:** render when `pending > 0`. Date = `min(activity[].available_on)` filtered to `status === 'pending' && available_on`. If no `available_on` is available, omit the date line and show amount only.
- **Held-for-unshipped row:** change visibility from `unshippedCents > 0` to `available > 0 && unshippedCents > 0`.
- **First payout hold banner:** keep as-is from the last plan, using the same earliest `available_on`.
- **Please note panel:** rewrite bullets per copy above.
- **Files touched:** `src/pages/SellerDashboard.tsx` only. No SQL, no edge functions.

## Out of scope

- Any change to how `availableToWithdraw` is computed (still `max(available − unshippedCents, 0)`).
- Any change to Stripe payout schedule settings.
- Backend edits to `stripe-connect-dashboard`.