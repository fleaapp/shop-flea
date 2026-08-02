## What's left

One Project monitoring finding, and it's real. I verified it against the live database: all 9 existing orders have `secure_checkout_fee = 0`, and none has a value above 0. The column was added on 2 Aug with `NOT NULL DEFAULT 0`, but the orders themselves were created 21–24 July, before the column existed — so every one of them was silently backfilled to zero.

Because the refund and display code treats "0" as a genuine saved value (`!== null && !== undefined`), those older orders now:
- refund the buyer the item + shipping share only, leaving out the 4% + $0.70 they actually paid,
- show `Secure Checkout Fee $0.00` on receipts, cart group totals, and order details, understating the buyer total.

The money isn't sent anywhere else — it just isn't returned.

## Fix

### 1. Backfill the legacy rows (migration)
Compute the historical fee per checkout group and write it back:
- Group orders by `checkout_reference` (fall back to `order_group_id`).
- Fee = `round(subtotal * 0.04 + 0.70, 2)` on the group's item subtotal, apportioned to rows the same way the app apportions it today.
- Skip groups where a fee-waiving coupon applied (`coupon_type` indicating FREEFLEA) — those legitimately paid $0.
- Only touch rows created before the column existed, so nothing written by live checkout is overwritten.

### 2. Harden the "is it saved?" check
Right now a real $0 and a backfilled $0 are indistinguishable. Change the check in `stripe-connect-refund` (`computeRefundBreakdown`), `Cart.tsx`, `OrderDetailsSheet.tsx`, and `OrderReceiptDialog.tsx` to treat the snapshot as authoritative only when the group sum is greater than zero **or** a fee-waiving coupon is recorded; otherwise fall back to `calculateSecureCheckoutFee(subtotal)` as before. This makes the code self-correcting even if another row slips through with a default.

### 3. Verify
- Re-query the orders table to confirm every legacy row now carries a non-zero fee (except any coupon-waived ones).
- Open a receipt for one of the July orders and confirm the fee line and buyer total are correct.
- Dry-run the refund breakdown for a legacy order and confirm `buyerRefund` includes the fee share.

## Technical notes

- The backfill is a data migration only; no schema change, no change to how new orders are written.
- `finalize-checkout` and `stripe-connect-payment-intent` already snapshot the fee correctly for new orders — they need no change.
- Nine orders are affected, so the backfill is small and reversible; I'll record the pre-update values in the migration comment for traceability.
