## Goal

In the Alerts list, tapping an order/sale notification opens the relevant details drawer inline — **except message notifications**, which continue to navigate to the chat.

## Routing rules (Notifications.tsx `handleNotificationClick`)

**Go to chat (unchanged):**
- `order_message_seller`, `order_message_buyer` → `/order-chat/:id`
- `support_message` → support thread

**Open Sale Details drawer (seller side, `SalesDetailsSheet`):**
- `item_sold` (already correct)
- `shipping_reminder_3d`, `shipping_reminder_6d` (already correct)
- `refund_request`
- `sale_auto_refunded`

**Open Order Details drawer (buyer side, `OrderDetailsSheet` — new instance on this page):**
- `order_shipped`
- `order_delivered`
- `refund_initiated`
- `refund_rejected`
- `order_auto_refunded`

**Unchanged:**
- `payment_action_required` → seller dashboard
- Comments / mentions / wishlist-sold / cart-sold → listing page

## Matching logic

Reuse the same lookup already used for `item_sold`:

1. Match `notification.related_order_id` against `group.order_group_id || group.id`, then against `group.orders[].id`.
2. Fallback: match `notification.related_listing_id` against `group.orders[].listing_id`.
3. Try the seller-side groups first for the seller list above, buyer-side groups for the buyer list above.
4. If no group is found (old orders paged out of the loaded set), fall back to today's `navigate(...)` target so the user never hits a dead end.

## Implementation

Only `src/pages/Notifications.tsx`:

1. Add state + render for the buyer drawer alongside the existing seller sheet:
   - `selectedBuyerGroup`, `orderSheetOpen`.
   - Render `<OrderDetailsSheet orders={selectedBuyerGroup?.orders ?? null} open={orderSheetOpen} onOpenChange={...} />` using the same props shape used on the buyer Orders view.
2. Add a small `findGroup(notification, groups)` helper implementing the matching logic above.
3. Replace the current `navigate('/cart')` branch for `order_shipped` / `order_delivered` and the `navigate('/order-chat/...')` branches for refund types with calls that open the correct drawer, keeping the existing navigation as fallback.
4. Leave the `markAsRead` call at the top of the handler untouched so badges keep clearing.

## Out of scope

Native push-notification tap handling and any drawer UI changes.
