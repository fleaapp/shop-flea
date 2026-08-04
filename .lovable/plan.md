# Order codes, pending summary, and seller refund button

## 1. Admin order codes now match the app

Admin Transactions invents its own code (`FLA-` + first 8 characters of the internal ID), while the rest of the app shows the real order number (`FL-001007`). Same order, two different codes.

Fix: admin uses the real order number everywhere - table, detail panel, and CSV export - falling back to the short ID only if an order somehow has no number. The order number is already loaded by the admin data function, so no database change is needed.

## 2. Seller dashboard pending summary trimmed

Remove the duplicated summary lines under the Pending total:

- "Sale total $4.25 - fees $0.59 = $3.66 to you, plus $0.50 clearing."
- "Next release 6 Aug 2026."

The itemised Pending funds list already shows each sale with its own amount, fee line, and release date, so the header keeps just the label and the total.

## 3. Refund action on sale details

Currently the only way to cancel an unshipped item is a small red "Cancel item" text link next to the price, which is hard to spot.

Change:
- Remove the per-item "Cancel item" text link.
- Add a clearly visible "Refund item" button directly below "Mark as shipped" (shown only while the sale is unshipped and not already refunded), styled as an outlined/secondary button so it reads clearly against the lime background.
- Single-item sales open the existing cancel/refund dialog straight away. Multi-item sales first show a short picker listing the items still eligible, then open the same dialog for the chosen item.

No change to the refund logic itself - it still uses the existing seller cancellation flow.

## Technical notes

- `src/types/admin/transactions.ts`: `getOrderCode` takes the order and returns `order_number ?? FLA-<short id>`; add `order_number` to `TransactionOrder`. Update callers in `AdminTransactions.tsx`, `TransactionTable.tsx`, `TransactionDetail.tsx`.
- `src/pages/SellerDashboard.tsx` lines 627-637: delete the two summary blocks (the `grossTotal`/`feeTotal`/`residual`/`earliestClearing` values stay in use for the rows).
- `src/components/SalesDetailsSheet.tsx`: drop the inline cancel link (lines 318-332), add the refund button near the "Mark as shipped" block, reusing `cancelOrderId` state and `CancelItemDialog`.
