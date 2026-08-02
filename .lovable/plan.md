## Verified state (no money is wrong)

- **Stripe:** refund `re_3TvxYFDPN6BH77fW1g5Pq1hn`, amount **$1.35**, status succeeded, with `transfer_reversal: trr_1TzxZRDPN6BH77fWMRAAL4YH`. The seller transfer was clawed back in full. Same shape for the second bundle.
- **Database:** all 4 order rows (FL-001003/4/5/6) are `status = refunded` with `refunded_at` set, `transaction_fee = 0.00`, `secure_checkout_fee = 0` (FREEFLEA).

So @sarahhearn2 has **$0.00** from these sales. The "$0.53 fee / You received $0.82" line is a **display bug only** - no payout, no ledger error. The seller dashboard already excludes refunded orders (verified: `SellerDashboard.tsx` filters with `isOrderRefunded` in the pending section), which is why the dashboard and this drawer disagree.

## Root cause

`src/components/SalesDetailsSheet.tsx:137-141`:

```
subtotal = sum(price + shipping) over ALL orders   -> 1.35
transactionFee = subtotal * 0.02 + 0.50            -> 0.53
youReceived = subtotal - fee                       -> 0.82
```

Two defects in three lines:
1. **Refund status ignored.** Refunded items still count toward seller earnings.
2. **Fee recalculated at today's rate** instead of reading the `transaction_fee` snapshot stored on the order - the exact class of bug already fixed on the buyer side for `secure_checkout_fee`.

## Fixes

**1. `src/components/SalesDetailsSheet.tsx` - seller earnings**
- Partition items with the existing `isOrderRefunded` helper from `useOrders.ts`.
- Subtotal, shipping and fee computed from non-refunded items only.
- Use the stored `transaction_fee` sum when any row carries a saved value; fall back to `2% + $0.50` only when no row has one (legacy orders).
- All items refunded: hide the Transaction Fee row, footer bar reads **"Refunded: $0.00"**.
- Some items refunded: footer stays "You received", counting active items only.

**2. Audit the same pattern everywhere seller money is displayed**
Apply the identical "exclude refunded + trust the stored fee" rule to:
- `src/components/OrderReceiptDialog.tsx` (already reads `transaction_fee` at line 114 - verify it excludes refunded items).
- `src/pages/Sales.tsx` seller card total bubbles.
- `src/pages/SellerDashboard.tsx` payout/activity rows (spot-check the non-pending sections; the pending section is already correct).

**3. Shared helper instead of four copies**
Add `computeSellerNet(orders)` to `src/utils/feeCalculator.ts` returning `{ activeOrders, refundedOrders, subtotal, shipping, transactionFee, youReceived, fullyRefunded }`, and use it in every surface above. This is what stops the bug from reappearing in the next screen someone adds.

**4. Backend cross-check (read-only, no changes unless a gap is found)**
Reconcile every `refunded` order in the database against Stripe: confirm each has a succeeded refund and, where a transfer existed, a matching reversal. Report any order where the reversal is missing or short. `stripe-connect-refund` already reverses correctly in both single-item and full-group modes; this is a verification pass, not a rewrite.

## Technical notes

- No migration and no Stripe action - the money is correct.
- Rounding stays `Math.round(x * 100) / 100`.
- Copy uses short dashes per project rules.

## Noted, not in scope

`supabase/functions/stripe-connect-refund/index.ts` still does raw REST calls against an `externalUrl` (`fetchOrderWithFallback`, `patchOrdersWithFallback`), which conflicts with the "Lovable Cloud only, no raw REST bypasses" project rule. It works today; flagging it as a separate cleanup rather than touching a live refund path in the same change as a display fix. Say the word and I'll fold it in.
