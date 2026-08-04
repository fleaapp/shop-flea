# Seller cancellation of unshipped orders

Let sellers cancel and refund an item they haven't shipped yet - for example the item is damaged, was sold elsewhere, or can't be found.

## What the seller sees

In Sale details, every item that is still awaiting shipping (not shipped, not refunded, no pending buyer refund request) gets a "Cancel item" action.

Tapping it opens a confirmation drawer with:
- A reason picker (required): Item no longer available / Item damaged or flawed / Sold elsewhere / Wrong price or listing details / Other (short text).
- A "Relist this item" toggle, on by default. Off means the listing stays off the app.
- Plain-English warning: the buyer gets a full refund including their fees, nothing is paid out to the seller for this item, and frequent cancellations can affect the account.

On confirm: the item is refunded, the buyer is notified, the item shows as Refunded in the sale, and the seller's cancellation count goes up. If it was the only item left in the order, the whole sale closes as refunded.

## Buyer side

The buyer gets a push and bell alert: "😔 @seller cancelled your order for "Item". You've been fully refunded." The order/item shows Refunded with the seller's reason visible in order details and in the order chat as a system message.

## Admin

Admin Users gains a "Seller cancellations" count column, and Admin Refunds labels these as "Seller cancelled" with the reason so repeat offenders are visible.

## Technical notes

- Migration: add `seller_cancel_count integer not null default 0` to `profiles` (and mirror in `profiles_public` sync if needed); add `cancelled_by_seller boolean` + reuse `refund_reason` on `orders`. Extend `profiles_update_guard()` so the counter is only writable by the security-definer RPC, not the client.
- New security-definer RPC `seller_cancel_order(p_order_id, p_reason, p_relist)`: validates caller is the seller, order is `awaiting`, `shipped_at IS NULL`, not already refunded; stamps `refund_reason`, `cancelled_by_seller`, increments the profile counter; sets the listing back to `active` when `p_relist`, otherwise leaves it terminal `refunded` (the `listings_update_guard()` needs a matching allowance for the relist path).
- Financial execution reuses the existing `stripe-connect-refund` edge function in `single` mode (per-item pro-rata shipping/fee unwind and transfer reversal) - no new payment logic.
- Notification + push emitted through the existing explicit edge-function call pattern, with a new `order_cancelled` type wired into `useNotifications.ts` routing so tapping it opens the order details drawer.
- UI: extend `SalesDetailsSheet.tsx` per-item rows with the cancel action and a new `CancelItemDialog` component following the existing confirmation-dialog styling (max-w 320px, rounded-2xl, flex-row footer).
- The existing 8-day `auto-refund-unshipped` job and the 48h post-delivery seller refund stay unchanged.
