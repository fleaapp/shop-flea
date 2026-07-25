# Investigation plan: where is Flea's Stripe balance going?

Before changing any refund/fee logic, do a full accounting pass on the live Stripe account (`acct_1SzqwoDPN6BH77fW`) using the secret key so we have concrete numbers, not theories.

## What I already know from a first pass

- **Charges are structured correctly.** `on_behalf_of` = seller + `transfer_data.destination` = seller means Stripe's ~1.75% + $0.30 processing fee is deducted from the SELLER at charge time, not Flea. Flea receives the full `application_fee_amount` ($0.74 on a $1 subtotal).
- **7 refunds so far ($6.48 total)**, all `requested_by_customer`, all with `transfer_reversal`.
- Both refund paths (`stripe-connect-refund/index.ts:600`, `auto-refund-unshipped/index.ts:263`) call Stripe with `reverse_transfer: true` **and** `refund_application_fee: true` — so the $0.74 fee is being clawed back to the buyer on every refund.
- At least one live charge (`ch_3TwHd2DPN6BH77fW1IZHmGYD`, $1.00) had **no** `application_fee` and **no** `on_behalf_of`. That behaves as a regular platform charge and DOES deduct Stripe's processing fee from Flea's balance. Need to know how many of these exist.

## Investigation steps

1. **Pull the last ~90 days of Balance Transactions** via the API and bucket by `type` (`charge`, `payment`, `refund`, `application_fee`, `application_fee_refund`, `transfer`, `transfer_reversal`, `stripe_fee`, `payout`, `adjustment`, `contribution`). Sum `amount`, `fee`, `net` per bucket. This is the ground truth for where the money moved.
2. **List every charge missing `on_behalf_of` or `application_fee_amount`.** These are the ones where Stripe's processing fee hits Flea directly. Confirm whether they are: (a) legacy test/demo/reviewer charges, (b) top-ups, (c) real orders that slipped through a code path that forgot the Connect params.
3. **Cross-check the 7 refunds:** for each refund, retrieve the associated `application_fee_refund` and `transfer_reversal` to confirm the $0.74 was actually returned to the buyer and the seller was actually debited. Confirm none left Flea holding an uncovered debit because the seller balance was too low.
4. **Check for disputes / early fraud warnings / adjustments** (`GetDisputes`, `GetIssuingDisputes` if any). Chargebacks debit the platform balance with a $15 dispute fee even when `on_behalf_of` is set.
5. **Check payouts to Flea's bank** (`GetPayouts`) vs. accumulated application fees. If payouts > application fees collected − refunds − dispute fees, something else is leaking.
6. **Confirm the Secure Checkout Fee is ONLY set as `application_fee_amount`** and not additionally being paid out as a `transfer` to the seller anywhere (sanity check `stripe-connect-checkout` and any other checkout path).

## Deliverable

A single written summary in chat with:
- Total gross application fees earned
- Total refunded application fees
- Total Stripe processing fees paid by Flea (should be ~$0 if Connect is set up right)
- Total dispute + adjustment cost
- Net platform revenue vs. what the code model expects
- Named list of any charges/refunds that behaved unexpectedly, with IDs

Only after that summary do we decide whether to change `refund_application_fee`, patch a checkout code path, or leave things alone.

## Not doing in this pass

- No code edits.
- No refund policy change.
- No changes to `stripe-connect-checkout` or the refund functions.
