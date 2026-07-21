## Root causes (app-wide duplicate alerts)

Two structural issues, both confirmed from the live DB and code:

### 1. Duplicate database triggers firing the same function on the same table
`pg_trigger` shows multiple triggers pointing at the same underlying function on several tables. Every INSERT/UPDATE runs the function 2–4×, so any notification, order side-effect, or timestamp write happens that many times:

| Table | Function | Trigger count |
|---|---|---|
| `orders` | `mark_listing_as_sold` | 3 (`on_order_created_mark_listing_sold`, `orders_mark_listing_as_sold_after_insert`, `trg_mark_listing_as_sold`) |
| `orders` | `generate_order_number` | 3 (`orders_generate_order_number_before_insert`, `set_order_number`, `trg_generate_order_number`) |
| `orders` | `update_updated_at_column` | 2 (`trg_update_orders_updated_at`, `update_orders_updated_at`) |
| `profiles` | `cleanup_user_listings_on_profile_change` | 3 (`on_profile_delete_cleanup`, `on_profile_status_cleanup`, `trg_cleanup_user_listings`) |
| `profiles` | `update_updated_at_column` | 2 |
| `listings` | `update_updated_at_column` | 2 |
| `reviews` | `update_user_rating` | 4 (`trg_update_user_rating`, `update_rating_on_review_insert/update/delete`) |
| `reports` | `process_report` | 2 (`on_report_created`, `trg_process_report`) |
| `saved_searches` | `update_updated_at_column` | 2 |
| `waitlist` | `set_waitlist_region` | 2 |

The dedup unique indexes on `notifications` mask *some* of this for message/comment/review/sold events, but any code path whose notification key doesn't match an existing dedup index (or that inserts via a different helper) still doubles.

### 2. Refund flow inserts the same notification + chat card from two places
On refund, the client calls `stripe-connect-refund`, which:
- Inserts buyer + seller `refund_initiated` notification rows.
- Inserts a `refund_initiated` system message into `order_messages` for each order in the group.

Then `order-messages` (`action: 'refund_initiate'`) is also invoked and it:
- Inserts another `refund_initiated` system message.
- Inserts another buyer `refund_initiated` notification.

Result matches the screenshot: two "Refund Initiated" cards in chat, and duplicate refund alerts.

## Fix

### A. Migration — drop every duplicate trigger

Keep only the canonical `trg_` version per (table, function):

- `orders`: drop `on_order_created_mark_listing_sold`, `orders_mark_listing_as_sold_after_insert`, `set_order_number`, `orders_generate_order_number_before_insert`, `update_orders_updated_at`.
- `profiles`: drop `on_profile_delete_cleanup`, `on_profile_status_cleanup`, `update_profiles_updated_at`. Keep `trg_cleanup_user_listings` + `trg_update_profiles_updated_at`.
- `listings`: drop `update_listings_updated_at`.
- `reviews`: drop `update_rating_on_review_insert`, `update_rating_on_review_update`, `update_rating_on_review_delete`. Keep `trg_update_user_rating` (already fires on INSERT/UPDATE/DELETE).
- `reports`: drop `on_report_created`. Keep `trg_process_report`.
- `saved_searches`: drop `set_saved_searches_updated_at`.
- `waitlist`: drop `set_waitlist_region_trigger`.

Also clean up notification rows created in the last 24 h that are exact duplicates (same `user_id, type, related_order_id, related_thread_id, related_listing_id, related_user_id, created_at`), keeping the lowest `id`.

### B. Refund flow — single source of truth

In `supabase/functions/order-messages/index.ts`, remove the `refund_initiate` branch's `insertSystemMessage` and `insertNotificationWithFallback` calls (lines ~701–727). `stripe-connect-refund` already emits both the buyer + seller notifications and the chat system message, so `order-messages` should just return success (still needed so the client's optimistic call has an endpoint to hit).

Leave `stripe-connect-refund` as the sole writer for `refund_initiated`.

### C. Verify

1. `pg_trigger` shows one trigger per (table, function) for the tables above.
2. Refund an order end-to-end from seller: exactly one "Refund Initiated" card in the chat, one buyer alert, one seller alert.
3. Complete a checkout: exactly one `item_sold` seller alert (currently possibly 3× via triple `mark_listing_as_sold`).
4. Post a support message: one "New message from Flea support" alert, one green dot.
5. Post a review: one `new_review` alert; rating on seller profile increments once.

## Out of scope

- Client-side `useNotifications` support-message fallback logic (only appends when no unread real notif exists; safe once the trigger stops double-firing).
- Push delivery pipeline changes.
- Rewriting notification content or emojis.