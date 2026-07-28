## Fixes

### 1. "Failed to update order" when buyer taps Mark as Delivered
The console shows PostgREST error PGRST203: two versions of `mark_order_delivered` exist in the database — the old 2-arg `(p_order_id, p_order_group_id)` and the new 3-arg `(p_order_id, p_order_group_id, p_source)` — so PostgREST can't pick one when the client calls it with 2 args.

Fix: migration that drops the old 2-arg overload so only the 3-arg version (with default `p_source = 'buyer'`) remains. The client keeps calling it the same way.

### 2. Missing overdue alerts
Today the `shipping-reminders` cron only notifies the **seller** (at 3d, 6d, 8d). The Cart/Sales UI defines "Overdue" as 4+ days, but neither buyer nor seller gets an alert tied to that threshold, so buyers never hear about it.

Fix: extend `supabase/functions/shipping-reminders/index.ts` to also insert a `order_overdue_buyer` notification + push at 4 days (matching the UI threshold) for orders still `awaiting`, deduped by order id so it only sends once per order. Seller reminders at 3/6/8d stay unchanged.

### Technical notes
- Migration: `DROP FUNCTION IF EXISTS public.mark_order_delivered(uuid, uuid);` (leaves the 3-arg version intact).
- New notification uses `related_order_id` for dedupe, wording e.g. "⏰ Your order is overdue — the seller hasn't shipped yet. Tap for options." and routes to the order details drawer via the existing notifications router.
