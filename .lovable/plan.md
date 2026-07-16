I found the likely root cause: the app is treating `refunded_at` as a display override only, while the database `status` column still cannot store `refunded` because its check constraint only allows `awaiting`, `shipped`, and `delivered`. That means refunded orders can remain active in lists if `refunded_at` is missing from the client response or stale cache, and the source status is still `awaiting`.

Plan:

1. Update the database order status model
   - Change the `orders.status` constraint to allow `refunded`.
   - Backfill every order with `refunded_at` set so `status = 'refunded'`.
   - Add a defensive rule/trigger so any future update that sets `refunded_at` also forces `status = 'refunded'`.

2. Update refund functions
   - Change seller refund and 9-day auto-refund code so they set both `refunded_at` and `status = 'refunded'` in the same update.
   - Keep the existing listing reactivation and notification behavior.

3. Harden the frontend status mapping
   - Normalize each order as refunded if either `status === 'refunded'` or `refunded_at` exists.
   - Fix group status initialization so single-item refunded groups are never initialized as `awaiting`.
   - Hide all active order actions, tracking prompts, shipping buttons, and refund buttons when a group is refunded.

4. Verify the specific broken case
   - Query the latest orders and confirm the refunded sale has `status = 'refunded'`.
   - Confirm the Sales screen logic will place it under the Refunded tab, not To Ship.
   - Check the Order and Sale details components read the same effective refunded status.