## Findings

Two audit issues found — the sale-notification fix didn't cover everything:

### 1. Duplicate triggers on `chat_messages` (support messages)
Both `on_support_message_notify` and `trg_notify_on_support_message` fire the same `notify_on_support_message()` function. Every support reply currently creates **2** notification rows → 2 pushes.

### 2. Duplicate triggers on `order_messages` (buyer/seller chat)
Both `on_order_message_notify` and `trg_notify_on_order_message` fire the same `notify_on_order_message()` function. Every buyer/seller chat message currently creates **2** notification rows → 2 pushes.

### 3. Missing dedup safety nets
Only order events (`idx_notifications_unique_order_event`) and listing-sold events (`idx_notifications_unique_listing_sold_event`) have unique indexes. Comments, mentions, reviews, and message events rely only on trigger uniqueness — no DB-level guard.

Everything else (single trigger + unique index or single trigger + idempotent function) looks correct.

## Fix (migration)

1. Drop the older duplicate triggers, keep the canonical `trg_` versions:
   - `DROP TRIGGER on_support_message_notify ON public.chat_messages`
   - `DROP TRIGGER on_order_message_notify ON public.order_messages`

2. Clean up any duplicate rows already created in the last 30 days for support and order message notifications (keep the earliest, delete siblings created within 5 seconds of it for the same user + type + related_order_id/related_thread_id).

3. Add safety-net unique indexes so any future duplicate-trigger regression is stopped at the DB layer:
   - `idx_notifications_unique_order_message` — `(user_id, type, related_order_id, created_at)` truncated to the second, WHERE `type IN ('order_message_buyer','order_message_seller')`. (Uses `date_trunc('second', created_at)` inside an expression index so simultaneous inserts collide but legitimate follow-up messages seconds later still succeed.)
   - `idx_notifications_unique_support_message` — same pattern on `related_thread_id` WHERE `type = 'support_message'`.
   - `idx_notifications_unique_comment_event` — `(user_id, type, related_listing_id, related_user_id, date_trunc('second', created_at))` WHERE `type IN ('new_comment','comment_reply','mention')`.
   - `idx_notifications_unique_review_event` — `(user_id, type, related_user_id, related_listing_id)` WHERE `type = 'new_review'`.

4. Verify only one push trigger (`trg_push_notification`) exists on `notifications` — already confirmed, no change needed.

## Verification

- Post-migration query: enumerate all triggers referencing `public.notifications` or notification-inserting functions and confirm each event source has exactly one.
- Query `notifications` for the last 24h grouped by `(user_id, type, related_order_id, related_thread_id, related_listing_id, date_trunc('second', created_at))` and confirm no group has count > 1.
- Ask user to send one comment, one order message, one support reply → confirm exactly one push each.

## Technical note
The `date_trunc('second', created_at)` in the expression indexes is intentional — it dedupes rapid-fire duplicates from double triggers/manual inserts without blocking legitimate repeat notifications the same minute (e.g. two real messages 10s apart).