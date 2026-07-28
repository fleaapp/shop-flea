## Remaining multi-item refund work

### 1. Admin dispute queue — per-item force refund
- Update `src/pages/admin/AdminApprovals.tsx` to flatten refund disputes so each order row in a bundle appears as its own actionable card.
- Add per-item "Force refund" action that calls `respond_to_refund_request` with the specific `order_id`.
- Keep order-group context visible (group label, sibling items) so admins understand bundle relationships.

### 2. Partial refund receipts & payout ledger
- Update receipt generation (`OrderReceipt.tsx` / `order-receipts` logic) to list refunded items separately and show pro-rata shipping + fee clawback.
- Update `SellerDashboard.tsx` ledger / `SalesDetailsSheet.tsx` payout math so partial refunds only deduct the refunded item's net from seller balance.

### 3. Pro-rata bundle shipping on refunds
- Add helper in `src/lib/feeCalculator.ts` to compute `refundedShipping = bundleShipping / refundedItemCount`.
- Apply the helper in `request_refund` RPC, `respond_to_refund_request` RPC, and receipt rendering.
- Ensure the buyer's refund total matches what they actually paid for that item.

### 4. FAQ / Terms / Privacy copy
- Add/refresh refund sections in FAQ, Terms, and Privacy to mention:
  - 48-hour buyer protection window after delivery
  - 72-hour seller response window before auto-approval
  - Pro-rata shipping refunds on bundles
  - Per-item refund eligibility

### 5. Notification deep-link polish
- Verify admin refund-dispute notifications route to `AdminApprovals` with the dispute pre-filtered.
- Verify seller/buyer refund-status notifications open the correct `SalesDetailsSheet` / `OrderDetailsSheet` for the right order group and item.

## Out of scope for this pass
- New database columns (existing `refund_*` fields on `orders` are sufficient).
- Changing the 48h/72h windows (copy only).

## Acceptance criteria
- Admin can force-refund a single item in a bundle without affecting siblings.
- Seller dashboard balance reflects partial refunds correctly.
- Receipts show itemized refund breakdown.
- Refund notifications open the right screen.