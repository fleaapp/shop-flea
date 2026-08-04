# Bundle-aware sold notifications

## What is actually happening

Confirmed in the database: the sold-alert trigger (`notify_users_on_listing_sold`) deliberately inserts only one `item_sold` alert per checkout group per seller, so a 2-item bundle produces a single alert. But that alert's copy is single-item ("Your item has just sold"), so it reads as if only one item sold, and the checkout function still fires one push per order - so the seller can get two pushes but one alert.

Cart/wishlist "item sold" alerts for other watchers are still inserted once per item, so a watcher of two items in the same bundle gets two near-identical alerts.

## Changes

1. **Seller bundle alert**
   - Keep one alert per checkout group, but make the copy bundle-aware:
     - Single item: `🎉🤑 Cha-ching! Your item "Top" has just sold. Tap to view the order.`
     - Multiple items: `🎉🤑 Cha-ching! Your bundle of 2 items has just sold. Tap to view the order.`
   - Alert opens the whole sale (the order group), as it does today.

2. **One push per bundle**
   - Stop the checkout function sending a push per order line. Send a single seller push per order group using the same bundle copy, so pushes and in-app alerts match one to one.

3. **Group cart/wishlist alerts too**
   - When several items a user is watching sell in the same checkout, produce one alert instead of one per item:
     - `😞 "Top" from your cart has just sold.`
     - `😞 2 items from your cart have just sold.` (and wishlist / combined variants)
   - Same grouping applied to their push notifications.

4. **Verification**
   - Re-check the notification rows for a multi-item checkout to confirm exactly one seller alert with bundle wording, one alert per watcher, and matching push payloads.

## Technical scope

- Update `notify_users_on_listing_sold` via a migration so the seller row's message and the cart/wishlist rows are built per `order_group_id` (dedupe watcher rows on group, count items for copy).
- Update `supabase/functions/finalize-checkout/index.ts` `createCheckoutNotifications` to fan out one push per recipient per group instead of per order.
- Update the sold-notification copy in `src/hooks/useNotifications.ts` and the raw-message handling in `src/pages/Notifications.tsx` so stored bundle messages render as-is with a safe single-item fallback for legacy rows.
- No changes to order creation, pricing, or payout logic.
