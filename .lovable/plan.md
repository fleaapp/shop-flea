
## Problem

After tapping an order chat and reading the messages, the red unread number on the order card (Orders/Sales tabs) and the corresponding count in the bottom-nav badge persist until a long delay or manual refresh.

Root cause is a combination of client cache freshness and a fire-and-forget mark-read call:

1. `useUnreadOrderMessages` (source of the per-order red pill on order cards) has `staleTime: 30_000` and no `refetchOnMount: 'always'`. If the user returns to the Orders tab within 30s of opening the chat, the cached `perOrder` Map is still considered fresh, so no refetch happens.
2. `useNavBadges` (source of the bottom-nav Sales/Cart badge) also has `staleTime: 30_000`. Same freshness trap.
3. In `OrderChat.tsx` the read-marking effect only fires the PATCH when the *client's local* `messages` array contains items with `read === false`. When the user opens the chat and the GET response already returns messages as unread, PATCH fires — but the invalidation of `['unread-order-messages']` and `['nav-badges']` is inside a `.then()` on a fire-and-forget promise. If the user taps back before the PATCH resolves, the badge queries stay unchanged and there is no optimistic local update to compensate.
4. The mark-read PATCH updates rows using the group id, but the two badge caches (`unread-order-messages`, `nav-badges`) are not optimistically updated for that group, so even a successful invalidate has to wait for the network round-trip on next mount.

## Fix

Make reading a chat clear the badges instantly on-device, and guarantee a truthful refetch on the next visit to the Orders/Sales list.

### 1. `src/pages/OrderChat.tsx`
- On chat mount (when `orderId` and `user.id` are known), fire the PATCH `order-messages` request unconditionally in a dedicated effect (not gated by "local messages currently look unread"). This avoids the race where GET is still loading.
- Immediately after opening the chat, optimistically zero out the entry for every id in `orderInfo.related_order_ids` inside the `['unread-order-messages', user.id]` cache and set `unread_buyer_msgs` / `unread_seller_msgs` / `seller_unread_per_order[id]` to 0 in `['nav-badges', user.id]`.
- After the PATCH resolves (success or failure), invalidate `['unread-order-messages']`, `['nav-badges']`, and `['notifications']` as today. On failure, roll back the optimistic update.

### 2. `src/hooks/useUnreadOrderMessages.ts`
- Add `refetchOnMount: 'always'` and `refetchOnWindowFocus: true`.
- Reduce `staleTime` to `0` (badge freshness matters more than a few extra reads; the query is cheap — two small selects filtered by user).
- Subscribe (via `useEffect`) to a scoped realtime channel on `order_messages` filtered by the buyer's/seller's order ids and invalidate the query on any `UPDATE` where `read` changes, so a device that receives the mark-read broadcast updates without waiting for a manual refetch.

### 3. `src/hooks/useNavBadges.ts`
- Add `refetchOnMount: 'always'`.
- Reduce `staleTime` to `0` for the same reason.
- Also subscribe to `order_messages` updates scoped to the user's active order ids and invalidate on `read` transitions.

### 4. `supabase/functions/order-messages/index.ts` (PATCH branch)
- After the update, return `{ success: true, updated: <count> }` so the client can log/verify. No behavioral change to the update itself.

## Verification

1. From the buyer account, open Orders tab: confirm the red per-card unread count matches DB `order_messages` where `sender_id != me and read=false`.
2. Tap the chat: the per-card red pill and the bottom-nav Sales/Cart badge must drop immediately (optimistic).
3. Navigate back within 3 seconds: pill and badge must remain at the new lower value (no flash back to the old count).
4. Repeat on the seller side (Sales tab) with an incoming buyer message.
5. Query `order_messages` in the DB to confirm `read=true` was persisted for the target order group.
