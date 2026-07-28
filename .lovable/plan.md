## Multi-item refund — remaining gaps to close

The buyer-side wizard ships selections + shared proof, but the surrounding surfaces still treat refunds as whole-order events. Here's what's left to make the flow complete end-to-end.

### 1. Seller side (SalesDetailsSheet)
- Show which specific items in a bundle have a pending refund request (badge on each line, not just one banner for the whole group).
- "Approve refund" / "Decline refund" buttons must act per-item — currently the accept/decline path assumes one order row per group.
- Surface the buyer's per-item reason + note under each item, and the shared proof gallery once at the bottom.
- Update the seller's 72h countdown copy to say "X of Y items" when partial.

### 2. Buyer side (OrderDetailsSheet)
- Per-item status pills: `Refund requested`, `Refund approved`, `Refund declined`, `Refunded` next to each line.
- Hide the "Request refund" button on items already in a refund lifecycle; keep it visible for still-eligible siblings.
- Show the buyer their submitted reason/note per item and let them view (not edit) the proof they uploaded.

### 3. Proof storage
- Confirm the shared proof set is uploaded once and referenced by every per-item `order_messages` row (right now the loop may re-upload or only attach to the first item). Store proof URLs on each refund message so admin/seller can see them per item.

### 4. Admin approvals queue
- `AdminApprovals.tsx` dispute + refund tabs need to group per-order-group and render each contested item as its own row (or a collapsible group) so the admin can force-refund individual items.
- Force-refund action must target a single `order_id` (already the case) but the queue currently lists them as flat orders — add the group context (order number + item index).

### 5. Notifications & emails
- Order status change notifications (`refund_requested`, `refund_approved`, `refund_declined`, `refunded`) fire per order row today — verify the copy reads naturally for one item of a bundle ("Refund requested for *Nike Dunks* in order #1234") instead of implying the whole order.
- Buyer + seller receipt / refund confirmation emails need a partial-refund template showing which items were refunded, remaining items, and updated totals.

### 6. Receipts & payout ledger
- `OrderReceiptDialog` and the seller payout activity list must render partial refunds correctly: show original bundle total, refunded item(s), and net kept.
- Seller dashboard "Available / Pending" math: confirm a partial refund only claws back the refunded item's net (price + its share of bundle shipping + its transaction fee), not the whole group.

### 7. Bundle shipping on partial refunds
- Decide + implement: when 1 of 3 bundled items is refunded, does the buyer get that item's shipping share back? Current bundle discount logic assumes all-or-nothing. Recommend: refund item's *pro-rata* shipping share, seller keeps shipping for items still delivered.

### 8. Auto-approve cron
- `auto-approve-refund-requests` already runs per order row — verify it logs the group context and doesn't double-fire when multiple sibling items expire in the same run.

### 9. Guardrails
- Prevent re-opening the wizard for items already requested (filter eligible list to exclude `refund_requested_at IS NOT NULL`).
- Cap total refund requests per order group per 48h window to stop spam re-submissions after a decline.
- Enforce that at least one item is selected before advancing to step 2 (belt-and-braces on top of the UI disable).

### 10. Copy updates
- FAQ + Terms: add a short line clarifying refunds can be requested per item on bundle orders, and that shipping refunds follow pro-rata rules.
- Refund request dialog step 2 header: "Proof applies to all selected items."

---

### Suggested build order
1. Storage + per-item message attachment (foundation for everything downstream).
2. Seller SalesDetailsSheet per-item accept/decline UI.
3. Buyer OrderDetailsSheet per-item status pills + guardrails.
4. Admin queue grouping + force-refund per item.
5. Bundle shipping pro-rata refund math + payout ledger updates.
6. Notification copy + partial-refund receipt template.
7. FAQ/Terms copy.

Want me to tackle all of this in one pass, or start with 1–3 (the user-visible core) and follow up with admin/ledger/copy after?