## Root cause

Edge function log for `order-messages` shows:

```
duplicate key value violates unique constraint "idx_notifications_unique_order_event"
Key (user_id, type, related_order_id)=(<seller>, order_message_seller, <orderId>)
```

Two overlapping unique indexes exist on `notifications`:

- `idx_notifications_unique_order_event` — covers `(user_id, type, related_order_id)` for **every** type with an `related_order_id`.
- `idx_notifications_unique_order_message` — the intended dedup for chat, keyed on `(user_id, type, related_order_id, created_at)`, only for `order_message_buyer` / `order_message_seller`.

The first index is too broad: the second and later chat messages on the same order collide on it, `insertNotificationWithFallback` re-throws the 23505, and the client shows "Failed to send message" even though the `order_messages` row itself might have inserted.

## Fix

### 1. Migration — narrow the over-broad dedup index
- Drop `idx_notifications_unique_order_event`.
- Recreate it with the same shape but exclude chat message types:
  ```sql
  CREATE UNIQUE INDEX idx_notifications_unique_order_event
    ON public.notifications (user_id, type, related_order_id)
    WHERE related_order_id IS NOT NULL
      AND type NOT IN (
        'order_message_buyer',
        'order_message_seller',
        'order_shipped',
        'order_delivered'
      );
  ```
  (Chat messages and status events already have their own `created_at`-scoped indexes; keep those unchanged so lifecycle events like `sale_confirmed` still dedup once per order.)

### 2. `supabase/functions/order-messages/index.ts` — belt-and-braces
In `insertNotificationWithFallback`, treat Postgres `23505` (unique violation) as a no-op success:
- On `error.code === '23505'`, log and return without throwing. Still fire push (dedup means a prior notif exists, but the fresh message still deserves the push).
- Existing `PGRST204` / missing-column fallback stays as-is.

This guarantees a notification-side dedup collision can never fail the message write again, even if a future index goes broad.

### 3. Verify the message row commits before pushing
Confirm the `order_messages` insert is committed **before** `insertNotificationWithFallback` is called (it already is, per `insertOrderMessage`). If any current code awaits the notification insert as part of the same response and returns 500 on failure, wrap that specific call in try/catch so a notif failure never rolls back the message send.

## Out of scope
- Other notification types, other dedup indexes, push pipeline changes.
- UI/toast copy; the "Failed to send message" toast will simply stop firing once the underlying 500 goes away.

## Verification
1. Send 3 chat messages back-to-back on the same order from @sarahhearn2 → @jcsbh: all three send, no error toast, three chat rows appear.
2. Recipient receives at least one push and sees the messages in the chat + a single (dedup'd) unread badge.
3. Edge function logs for `order-messages` show zero new `23505` errors.
4. Lifecycle events (sale confirmed, refunds) still dedup — creating a second `sale_confirmed` notif for the same order is still blocked by the narrowed index.
