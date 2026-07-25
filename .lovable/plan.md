## Investigate why platform balance is -A$9.81 and net volume is -A$4.75

The screenshots are the **platform account's own balance and Reports overview** in Stripe — not per-charge fees. That balance moves for reasons the per-charge audit doesn't surface (payouts to your bank, Stripe fees on non-Connect charges, dispute fees, reversal debits when the seller balance was too low, currency conversion). We need to look at the actual balance transactions to explain the exact -A$9.81.

### Investigation steps (read-only, via Stripe secret key)

1. **List every Balance Transaction** on `acct_1SzqwoDPN6BH77fW` for the current reporting window shown in the screenshots. Bucket by `type` and sum `amount`, `fee`, `net`:
   - `charge` / `payment` — money in
   - `application_fee` — Flea's $0.74 fee inflows
   - `refund` — money out on refunds
   - `application_fee_refund` — Flea's fee given back
   - `transfer` / `transfer_reversal` — money moving to/from seller accounts
   - `stripe_fee` — Stripe processing fees hitting Flea directly (should be ~0)
   - `payout` — money leaving to Flea's bank
   - `adjustment` / `contribution` — disputes, chargebacks, corrections

2. **Sum reconciliation**: the running total of `net` across all balance transactions must equal exactly -A$9.81. Whatever bucket dominates the negative side is the actual cause.

3. **Specifically check**:
   - Any `payout` to Flea's bank (money left the Stripe balance).
   - Any `stripe_fee` line items not attached to a Connect charge (means a charge slipped through without `on_behalf_of`).
   - Any `transfer_reversal` where the seller balance was insufficient — Flea eats the shortfall.
   - Any Apple Pay / Link / currency conversion adjustments.
   - Dispute fees (A$22.50 each on AU).

4. **Cross-reference the Reports overview -A$4.75**: "Net volume from sales" excludes payouts and non-sale adjustments, so the delta between -A$9.81 (balance) and -A$4.75 (net sales) itself tells us how much is payouts vs. sale-side losses.

### Deliverable

A single written summary in chat with a line-by-line breakdown of every balance transaction contributing to the -A$9.81, grouped by cause, plus the specific IDs of any charges/refunds/payouts driving it. **No code changes** in this pass.