## What's going on

You're right about the direction, and the data confirms it. There are only 9 order rows across 7 payments in the whole database, all from 21-24 July 2026, and the stored fee values no longer match what the payment provider actually captured.

Two things happened:

1. **A backfill wrote today's fee formula onto old rows.** Orders created before the current fee rules had `secure_checkout_fee = 0`, so a later repair pass recalculated them at 4% + $0.70 and wrote $0.75 onto rows that were never charged that.
2. **The coupon record was lost on the order rows.** Every order row has `coupon_code = NULL`, yet the payment intent metadata for at least the two bundles you screenshotted clearly records `coupon_code: FREEFLEA` and `secure_checkout_fee_aud: 0.00`. Because the row looked "coupon-free", the backfill had no reason to leave the fee at zero.

Net effect on your two screenshots: both bundles were charged **$1.35** and refunded **$1.35** - a full 100% refund, not 50%. The $2.10 shown is a display total built from the wrongly backfilled $0.75 fee.

## Plan

**1. Reconcile every order against the payment provider (source of truth)**

For each of the 7 payment references, pull the actual PaymentIntent/charge and read `amount`, `secure_checkout_fee_aud`, `transaction_fee_aud`, `coupon_code`, `coupon_id`:

```text
pi_3TwYYUDPN6BH77fW09TuN5Cx   shown $1.74
pi_3TwHd2DPN6BH77fW1tMIxVsf   shown $1.74
pi_3Tvxx0DPN6BH77fW0t16EcMf   shown $2.10   (actual charge $1.35)
pi_3TvzN5DPN6BH77fW2qtsNkx8   shown $1.22
pi_3TvxYFDPN6BH77fW1IRp1GbX   shown $2.10   (actual charge $1.35)
pi_3TvYVzDPN6BH77fW0rFeLkeF   shown $1.22
pi_3TvRyhDPN6BH77fW2HAHrBfC   shown $1.22
```

Produce a comparison table (stored total vs captured amount) before changing anything, and share it with you.

**2. Correct only the rows that disagree**

Write back the historical truth per order row - `secure_checkout_fee`, `transaction_fee`, `coupon_code`, `coupon_type`, `coupon_id` - taken from the payment metadata, never recalculated. Rows that already match are left alone. This is a data change via the insert/update tool, not a schema migration.

**3. Stop the backfill from ever inventing a fee again**

Remove/neutralise the "recalculate when fee looks like zero" fallback so a historical order is never re-priced with current rules. If a payment reference exists, the captured amount and its metadata are authoritative; if no metadata exists, leave the stored value as-is rather than guessing.

**4. Persist coupon data on every row at checkout**

In `stripe-connect-payment-intent` / `finalize-checkout`, write `coupon_id`, `coupon_code`, and `coupon_type` onto **all** order rows in the bundle, so a waived fee is provably waived and future repairs can't misread it.

**5. Display guard**

In `OrderDetailsSheet.tsx`, `SalesDetailsSheet.tsx` and the receipt, when the summed line items don't equal the captured amount, show the captured amount as "Total amount paid" so the customer-facing figure can never drift from what was really charged.

## Technical notes

- Reconciliation reads use the Stripe API tools (`stripe_api_read`) against the live account; no writes to Stripe.
- Files likely touched: `src/utils/feeCalculator.ts` (drop the recalculation fallback), `supabase/functions/finalize-checkout/index.ts` and `supabase/functions/stripe-connect-payment-intent/index.ts` (persist coupon fields), plus the two details sheets and receipt component.
