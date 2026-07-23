## Root cause (verified)

The footer/bell badge counts unread rows in the `notifications` table (`get_nav_badges.activity_unread` = `COUNT(*) FROM notifications WHERE user_id=_ AND is_read=false`).

- Opening an `OrderChat` calls `order-messages` PATCH, which only sets `order_messages.read=true`. It never touches the corresponding `notifications` rows (`order_message_buyer` / `order_message_seller`).
- Opening a support `ChatConversation` calls `mark_support_thread_read`, which only touches `chat_messages`. It never touches `notifications` rows of type `support_message`.

Result: the optimistic `setQueryData` in `OrderChat.tsx` briefly drops the number (8 → 7), then the next `get_nav_badges` refetch returns the true DB value (8 again) because the notification row is still `is_read=false`. Same pattern for support chat and (likely) new-comment / refund notifications where the app has no "seen" step.

## Fix

Make "opening a chat" authoritatively clear every notification row tied to that chat, server-side, so the RPC refetch returns the decremented count.

### 1. `supabase/functions/order-messages/index.ts` (PATCH branch)

After the existing `order_messages.update({read:true})`, also update `notifications`:

- `user_id = <caller>`
- `type IN ('order_message_buyer','order_message_seller')`
- `related_order_id IN (<threadOrderId + related_order_ids>)`
- `is_read = false` → `true`

Use the same external client + fallback pattern already used for inserts.

### 2. `mark_support_thread_read` RPC

Extend to also `UPDATE notifications SET is_read=true WHERE user_id=auth.uid() AND type='support_message' AND related_thread_id=_thread_id AND is_read=false`. Keep the existing `chat_messages` update.

### 3. Client optimistic alignment

- `src/pages/OrderChat.tsx`: in addition to the existing `unread-order-messages` / `nav-badges` writes, decrement `activity_unread` by the count of cached `notifications` rows that match the related order group + message types, and mark those notification rows `is_read=true` in the `['notifications']` cache. Then invalidate `['notifications']` and `['nav-badges']` after the PATCH resolves.
- `src/pages/ChatConversation.tsx`: same treatment for `support_message` notifications tied to `threadId`.

This removes the visible "8 → 7 → 8" flicker: the optimistic drop and the refetch both land on the same true count.

### 4. Verification

- Log in as @sarahhearn2, open an order chat with an unread message + matching bell notification; confirm footer alerts badge decrements and stays decremented after route change and full reload.
- Repeat for support chat.
- Confirm `notifications` rows for that order/thread are `is_read=true` via a quick DB read.

## Out of scope

No UI changes, no changes to how notifications are created, no changes to comment / refund notification flows (those already have their own read paths and are not part of this reported bug).
