
Verified from live DB + code, not guessed:

- `push_subscriptions` currently has **only @jcsbh's** iOS token registered (`c4688f02…`). **@sarahhearn2 has zero rows.** So every push destined for jcsbh lands on Sarah's device, and no push destined for Sarah reaches anyone. That is the exact bug.
- The support-thread unread row (`91f5d0d1…`, `sender_type='support'`) has `sender_id = 6b0dd9d6…` (Sarah's own uid). The RLS UPDATE policy on `chat_messages` is `sender_id IS DISTINCT FROM auth.uid() AND thread owner`. Because `sender_id = auth.uid()`, the PATCH silently updates zero rows → badge stays.
- The two persistent order-chat unread rows (`89cd05db…`, `e284125a…`) belong to orders in status `refunded`. `get_nav_badges` correctly ignores them, but `useUnreadOrderMessages` (used by BottomNav, Cart, Profile, Sales, SellerDashboard, and both detail sheets) queries **every** order with no status filter, so the sales-tab dot never clears.
- `order-messages` edge function `awaits` `firePushNotification` inline, adding ~500–1500 ms to every send.
- Double in-app alerts most likely = one DB trigger insert + one edge-function explicit push/insert on the same event; scan and eliminate the duplicate source.

### Plan

1. **Fix wrong-user / missing push tokens (root cause of both push issues)**
   - In `useNativePushNotifications`, when the signed-in user changes and `checkCloudTokenStatus` returns `hasIosToken=false`, always call `PushNotifications.register()` with `{ force: true }` — do not gate on cloud status only. Currently after "not granted" fast-path or a silent early-return, no takeover happens.
   - Additionally, when the last-saved endpoint in `localStorage.flea_native_push_endpoint` exists but belongs to a different `user.id` than the current one, immediately POST it to `register-push-subscription` to take over the endpoint before waiting for a fresh APNs callback.
   - In `AuthContext.signOut`, keep the existing delete but also clear `localStorage.flea_native_push_endpoint` so the next account starts clean.
   - In `register-push-subscription`, log the takeover row count and return it so we can confirm from client logs.
   - Add a one-shot "reclaim on sign-in" call: on every AuthContext sign-in (native only), invoke `register-push-subscription` immediately with the cached endpoint (if any) so takeover happens even if APNs `registration` never re-fires.

2. **Fix persistent support-chat badge**
   - New migration: replace the current `chat_messages` UPDATE policy with one that lets the thread owner mark any non-`user` message read regardless of `sender_id` (drop the `sender_id IS DISTINCT FROM auth.uid()` clause for reads-only updates), OR add a `SECURITY DEFINER` RPC `mark_support_thread_read(_thread_id uuid)` and call it from `ChatConversation` instead of the direct PATCH. Prefer the RPC — smaller blast radius, keeps existing policy for other update paths.
   - Also mark the matching `notifications` row read via the same RPC transactionally so the alerts badge clears in one call.

3. **Fix persistent order-chat sales badge**
   - Update `useUnreadOrderMessages` to only include orders whose `status IN ('awaiting','shipped')`, matching `get_nav_badges`. Refunded / delivered-locked chats can no longer be opened to clear, so they must not count.
   - As a secondary safety net, run a one-off SQL to set `read=true` on `order_messages` for orders where `status='refunded'` (unreachable UI state).

4. **Fix double in-app alerts**
   - Audit for a duplicate notification source: check DB triggers on `order_messages`, `chat_messages`, `listings_comments`, and any `notify_*` function still enabled. Drop any trigger that inserts a `notifications` row when the corresponding edge function (`order-messages`, `add-listing-comment`, `comment-mentions`, refund flow) already inserts one. Memory rule: "Trigger push via explicit edge function calls, NOT database triggers."
   - Add a short client-side dedupe in `RealtimeAlerts`: ignore any INSERT whose `id` was already toasted in the last 5 s.

5. **Fix slow order-chat send/load**
   - In `supabase/functions/order-messages/index.ts`, stop `await`ing `firePushNotification` — fire-and-forget via `EdgeRuntime.waitUntil(firePushNotification(...))` so the HTTP response returns as soon as the row is inserted.
   - Return the inserted message inline (already done) so the client can optimistically render it without waiting for the 5 s poll.
   - On the client, on successful send, prepend the returned row into the React Query cache instead of relying on invalidate + refetch.
   - Drop `refetchInterval: 5000` on `['order-messages', orderId]` when the realtime channel is subscribed (channel already invalidates), removing the constant polling cost that competes with sends.

6. **Verification steps after build**
   - Sign in as @sarahhearn2 on the native build → confirm a new `push_subscriptions` row appears with her user_id and the jcsbh row is gone (single SQL check).
   - Send a support reply to Sarah as admin → confirm badge appears, open thread → confirm badge clears (RPC returns >0 rows).
   - Open a refunded sale → confirm sales dot no longer sticks.
   - Send an order chat message → confirm round-trip returns <300 ms and only one toast fires on the recipient.

### Technical notes

- Files touched:
  - `src/hooks/useNativePushNotifications.ts` (force-registration + endpoint takeover on user change)
  - `src/context/AuthContext.tsx` (clear cached endpoint, reclaim on sign-in)
  - `src/hooks/useUnreadOrderMessages.ts` (status filter)
  - `src/pages/ChatConversation.tsx` (call new RPC)
  - `src/pages/OrderChat.tsx` (optimistic insert, drop polling)
  - `src/components/RealtimeAlerts.tsx` (5 s dedupe)
  - `supabase/functions/order-messages/index.ts` (fire-and-forget push)
  - `supabase/functions/register-push-subscription/index.ts` (return takeover count for logging)
- Migrations:
  - `mark_support_thread_read(_thread_id uuid)` SECURITY DEFINER RPC + grant to `authenticated`
  - Drop any leftover `notify_on_*` triggers still creating duplicate `notifications` rows (list them from `pg_trigger` first, then drop only the confirmed duplicates)
  - Backfill `read=true` on `order_messages` for `orders.status='refunded'`
- Roll-out is DB migration first, then edge fn deploy, then client build.
