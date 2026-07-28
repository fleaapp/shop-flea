The per-item refund UI is in place, but the backend/admin/ledger/legal layers still treat refunds as whole-order. These are the remaining pieces to make per-item refunds coherent end-to-end.

### 1. Admin dispute queue — per-item force refund
**What:** In `AdminApprovals.tsx` the dispute tab currently lists one row per `orders` record, but the underlying `stripe-connect-refund` edge function still marks an entire `order_group_id` as refunded. For bundles, force-refunding one item must refund only that item.

**How:**
- Update `stripe-connect-refund` to accept an optional `amount` and a `mode` flag (`single` vs `cascade`).
- When `amount` is provided, refund only the requested `orderId` and update only that row’s `refunded_at`/`status`.
- Update `useAdminApprovals.ts` `forceRefund` to pass the individual order ID and computed refund amount.
- Update `AdminApprovals.tsx` dispute rows to show each disputed item separately with its title/price and a "Force refund item" action.

### 2. Partial refund receipts & seller ledger
**What:** `OrderReceiptDialog.tsx` and `SellerDashboard.tsx` assume a group is either fully refunded or not. They need to show itemised partial refunds, returned shipping, and clawed-back seller transaction fees.

**How:**
- Add `calculateProRataRefund` helper in `src/utils/feeCalculator.ts`.
- Update `OrderReceiptDialog.tsx` to render a per-item breakdown: item price, pro-rata shipping, pro-rata Secure Checkout Fee, pro-rata Transaction Fee, net refund/earnings.
- Update `SellerDashboard.tsx` "Sales in progress" / ledger math so partially-refunded bundle items reduce the seller’s expected payout correctly.

### 3. Pro-rata bundle shipping on refunds
**What:** When a buyer refunds 1 item from a 3-item bundle, the returned shipping must be `total shipping ÷ item count` (or based on the seller’s bundle settings), not the full shipping cost.

**How:**
- In `stripe-connect-refund`, fetch the seller’s `bundle_shipping_mode`/`bundle_shipping_discount_percent` and each listing’s raw `shipping_price`.
- Compute each item’s share of the charged shipping and refund that share.
- Store the refunded shipping share on the order row (or in metadata) so receipts and ledger can display it.

### 4. FAQ / Terms / Privacy copy
**What:** Buyers and sellers need clear copy explaining the new refund rules.

**How:**
- Update `src/components/FAQSection.tsx`, `src/pages/Terms.tsx`, and `src/pages/PrivacyPolicy.tsx` to explain:
  - 48-hour buyer protection refund-request window.
  - 72-hour seller response window before auto-approval.
  - Pro-rata shipping refunds on multi-item orders.
  - Per-item refund eligibility.

### 5. Notification deep-link polish
**What:** Admin, seller, and buyer notifications about refunds/approvals/disputes should open the correct screen with the right order/item pre-selected.

**How:**
- Update `src/pages/Notifications.tsx` routing for `refund_request`, `refund_declined`, `refund_initiated`, and `dispute_escalated` types.
- Ensure bundle notifications carry `related_order_id` and, where possible, the specific item ID.
- Make `OrderDetailsSheet.tsx` and `SalesDetailsSheet.tsx` accept an optional `highlightOrderId` prop to scroll to / expand the relevant item.

### Out of scope for this plan
- Changing the overall buyer-protection / 48h/72h windows (already implemented).
- New UI for refund selection (already implemented in `RefundRequestDialog.tsx`).

Want me to implement all of these now, or focus on a specific slice first?