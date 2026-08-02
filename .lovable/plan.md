## Payments audit - what I verified

I checked the live order data against Stripe and read the fee code paths end to end.

**Healthy:**
- All 9 orders have non-null fee snapshots, no refunded rows missing `refunded_at`, every row has a group and checkout reference.
- Historical orders match Stripe exactly. Example: order FL-001009 stored `secure_checkout_fee 0.74`, `transaction_fee 0.00`; Stripe charged 174c with an application fee of 74c. The FREEFLEA orders correctly stored $0 fees.
- Per-item (partial) refunds are mathematically correct: buyer gets item + pro-rata secure fee, seller transfer is reversed by item minus pro-rata transaction fee, and the platform keeps exactly the remaining items' fee share.
- Full-group refunds use `reverse_transfer` + `refund_application_fee`, so nobody is left holding fees.
- Payout gating correctly holds funds for orders still in buyer protection and charges the 1.5% instant fee via a platform transfer.

## Issues to fix

**1. Application fee can exceed the charge on cheap items (hard checkout failure)**
`stripe-connect-payment-intent` sets the application fee to secure fee + transaction fee. For a subtotal under about $0.51 the application fee is larger than the amount charged and Stripe rejects the PaymentIntent. With FREEFLEA applied the threshold is higher still, because the buyer fee is waived but the seller fee is not. Sellers also net a negative-feeling amount on very low-priced items ($1.00 subtotal pays out $0.48).

Fix: clamp the application fee to the charge amount minus 1 cent as a safety net, and add a minimum listing price (suggested $3.00) enforced in `CreateListing`/`EditListing` and validated server-side, with clear copy explaining why.

**2. Transaction fee is duplicated across sellers in `finalize-checkout`**
Line ~495 writes the whole checkout's `transactionFeeTotal` onto the first row of *every* seller. Single-seller checkouts (all we allow today, since the PaymentIntent function rejects `multi_seller_checkout`) are unaffected, but the moment multi-seller carts are enabled this over-charges sellers and breaks refund math.

Fix: compute the transaction fee per seller from that seller's own subtotal, matching how shipping is already allocated.

**3. `computeSellerNet` can invent fees on legacy rows**
The helper falls back to `calculateTransactionFee(subtotal)` when no snapshot exists. Every existing row has a snapshot so nothing is wrong today, but any future row that fails to write a fee would silently show a fabricated deduction.

Fix: drop the fallback and treat a missing snapshot as $0, which is the only value that can be reconciled against Stripe.

**4. Seller earnings preview is wrong for bundles**
`sellerEarningsPreview` applies the full $0.50 fixed fee to a single listing. The fee is charged once per order, so a 3-item bundle preview under-states earnings by $1.00.

Fix: label the preview as "if sold on its own" and show the fee as per-order in the listing form copy.

**5. Fee label shows a rate on zero-fee historical sales**
Sales details renders "Transaction Fee (2% + $0.50) - $0.00" for pre-fee orders, which reads like a bug to sellers.

Fix: hide the line entirely when the snapshot is $0, same as the fully-refunded case.

## Technical notes

- Files: `supabase/functions/stripe-connect-payment-intent/index.ts`, `supabase/functions/finalize-checkout/index.ts`, `src/utils/feeCalculator.ts`, `src/components/SalesDetailsSheet.tsx`, `src/pages/CreateListing.tsx`, `src/pages/EditListing.tsx`.
- No database migration or backfill is required - the stored data already reconciles with Stripe.
- The minimum price rule needs both a client check and a server check in the PaymentIntent listing validation so old app builds cannot bypass it.
