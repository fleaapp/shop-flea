## Goal
Once an order (or order group) has `refunded_at` set, every surface should show it as **Refunded** and hide all active order actions (Mark as shipped, Awaiting shipping status, Request refund, Mark as delivered, tracking edit, etc.).

## Changes

### 1. `src/hooks/useOrders.ts`
- Extend `OrderStatus` type to include `'refunded'` (UI-only value, DB `status` stays untouched).
- In `getGroupStatus`, if every order in the group has `refunded_at`, return `'refunded'`. (If mixed, keep existing logic — currently no partial refunds.)
- Expose a helper `isRefunded(order)` = `!!order.refunded_at` and `isGroupRefunded(group)` = all orders refunded.

### 2. `src/pages/Sales.tsx`
- Add a **Refunded** segment to the status filter row alongside To Ship / Shipped / Delivered.
- `getStatusBadge` gains a `'refunded'` case: label "Refunded", muted styling.
- Filter logic: a group is shown under "Refunded" if `isGroupRefunded(group)`; exclude refunded groups from To Ship / Shipped / Delivered buckets and from the overdue calculation.

### 3. `src/components/SalesDetailsSheet.tsx`
- If `primaryOrder.refunded_at`:
  - Header status pill reads "Refunded".
  - Tracking section: show "Refunded" instead of the "Awaiting shipping" editable inputs; hide the Save tracking / Mark as shipped button entirely.
  - Hide the "Refund sale" button (already partially gated) and any shipping edit affordance.
  - Keep read-only tracking values if they exist (post-ship refund case).

### 4. `src/components/OrderDetailsSheet.tsx` (buyer side)
- If `primaryOrder.refunded_at`:
  - Status row shows "Refunded" instead of "Awaiting shipping".
  - Hide "Request refund" and "Mark as delivered" action buttons.
  - Tracking rows show "Refunded" when there is no tracking, otherwise the real values (read-only).

### 5. Orders list on Profile / Purchases (if it uses `useOrders` group status)
- Because `getGroupStatus` now returns `'refunded'`, any tab filter based on status will naturally exclude refunded orders from active tabs. Add a **Refunded** tab/section wherever buyer orders are grouped (mirror the Sales change) so buyers can still find them.

### 6. `src/pages/OrderChat.tsx`
- If the underlying order group is refunded, disable the "Mark as shipped" / "Mark as delivered" quick actions and show a small "This order was refunded" system note above the composer. Messaging itself remains available.

### 7. Admin transactions
- `getTransactionStatus` already returns `'refunded'` when `refunded_at` is set — no change needed, but double-check the sales list badge picks it up.

## Out of scope
- No DB schema or edge-function changes; refunds already write `refunded_at`.
- No changes to notifications copy.

## Verification
- Open the previously-refunded sarahhearn2 → jcsbh order:
  - Sales tab: appears under new "Refunded" filter with a Refunded pill, not under To Ship.
  - Sale details sheet: shows Refunded, no Mark as shipped button.
  - Buyer's order details sheet: shows Refunded, no Request refund / Mark as delivered.
