
## Problem summary

Confirmed from the code, not assumed:

1. **@jcsbh push arrives on @sarahhearn2's device / sarahhearn2 gets nothing.** `useNativePushNotifications` only saves an APNs token on registration. `signOut` in `AuthContext` never removes the previous user's `push_subscriptions` row, and `register-push-subscription` only clears *other tokens for the same user_id* (`user_id = X AND platform = ios AND endpoint != new`). The APNs token for this device stays attached to whichever user first registered it (jcsbh), so `send-push-notification` still finds jcsbh's row for that endpoint and sarahhearn2 never gets one saved (registration is skipped when the OS-cached token equals a token already stored for *some* user, and even if it saves, jcsbh's row still exists).
2. **In-app double alerts on new order/support messages.** `RealtimeAlerts` subscribes to `notifications` INSERTs and fires a sonner toast for every type including `order_message_*` / `support_message`. When the OS delivers the push while the app is foregrounded, the user also sees an OS banner. Both paths trigger for the same event.
3. **Support-chat badge doesn't clear after opening a thread.** `ChatConversation` runs the "mark read" effect with `messages.length` in the deps and invalidates `nav-badges`, but the update happens *before* `messages` is populated (initial length is 0, then again after fetch — but on Cloud the client `chat_messages` UPDATE is silently blocked because the RLS UPDATE policy was rewritten in `20260707041454...` after `20260715001455...` dropped it, leaving no client-side UPDATE policy for `chat_messages` on the active migration state). Needs verification of live policy state, but the badge symptom matches "update returns 0 rows".
4. **Order-chat unread badges persist.** `OrderChat` calls the `order-messages` edge function to mark-read, but the function writes to the external Supabase (`EXTERNAL_SERVICE_ROLE_KEY` path in `order-messages/index.ts`), while `useNavBadges` reads `order_messages.read` from Cloud. Reads and writes hit different databases, so `read` never flips in Cloud.
5. **Messages slow to send/load.** Same split-brain: `OrderChat` fetches via edge function (external DB) then subscribes to Cloud realtime for the *same* table; edge function cold-starts every open, and the realtime channel never receives events because inserts land in the external DB. UI waits for the edge function round-trip on every send.

Root causes 4 and 5 need a live DB spot-check before we commit to the fix — the current `order-messages` edge function still points at an external Supabase, which contradicts the "Lovable Cloud is the ONLY database" project rule. Step 1 of the plan verifies this against the live function env before rewriting.

## Plan

### 1. Verify current backend split (read-only, first step in build mode)

- Query `push_subscriptions` for the two usernames' user_ids to confirm which user owns the device's APNs token.
- Query `chat_messages` RLS policies and `pg_policies` for current UPDATE policy state.
- Inspect the deployed `order-messages` function config to confirm whether `EXTERNAL_SUPABASE_URL` / `EXTERNAL_SERVICE_ROLE_KEY` are still set. If yes, order messages really are landing on the wrong DB.
- Report findings before changing code so we don't guess.

### 2. Fix APNs token / account mixup

- In `AuthContext.signOut`: before `supabase.auth.signOut`, best-effort delete the current user's `push_subscriptions` rows for `platform='ios'` on this device (call a new lightweight edge function `unregister-push-subscription` with the current endpoint, or delete via authenticated client). Guard against network failure so sign-out still proceeds.
- On native, capture the current APNs token on sign-in via `PushNotifications.checkPermissions` + a cached `lastKnownToken` in localStorage so we can pass it to the unregister call.
- In `register-push-subscription`: when platform is `ios`, additionally delete rows with the same `endpoint` belonging to *other* `user_id`s (device changed hands). This makes registration idempotent per device, not per user+device.
- In `useNativePushNotifications`: force re-registration when `user.id` changes (currently gated by `checkCloudTokenStatus` which returns true for jcsbh's leftover row and skips saving sarahhearn2's).

### 3. Kill duplicate in-app toasts

- In `RealtimeAlerts`: skip sonner toasts for notification types that also fire an OS push while the app is foregrounded (`order_message_seller`, `order_message_buyer`, `support_message`, `new_comment`, `comment_reply`, `mention`). The OS banner is the single source of truth for these; keep sonner only for events without a matching push path or when the app is on the exact screen the notification points to.
- Alternatively (chosen): keep sonner as the in-app surface and suppress the OS banner while the app is foregrounded by adding a `pushNotificationReceived` listener that calls `PushNotifications.removeDeliveredNotifications` for the matching tag. Pick one; plan defaults to the first (suppress sonner) since it needs zero native changes.

### 4. Fix support-chat unread badge

- After step 1 confirms the live UPDATE policy on `chat_messages`, either re-add the "user can mark their own thread messages read" UPDATE policy (if it was dropped) or move the mark-read call into a `mark-chat-thread-read` edge function using the service role. Preferred: edge function, so the client can't be blocked by RLS drift again.
- Have `ChatConversation` await the mark-read call before invalidating `['nav-badges']` and `['unread-support']`, and invalidate again on unmount so the badge clears even if the last message arrived after the initial mount.

### 5. Fix order-message send/load latency and unread badges

- Point `order-messages` edge function at Cloud (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`) so writes hit the same DB the client reads. Remove the `EXTERNAL_*` branch entirely.
- In `OrderChat`:
  - Send messages via a direct authenticated `supabase.from('order_messages').insert(...)` (RLS scoped to participants) instead of round-tripping through the edge function for the hot path. Keep the edge function only for the mark-read + notification fanout.
  - Fetch initial messages via `supabase.from('order_messages').select(...)` directly and let the existing realtime channel handle live updates. This removes the cold-start latency on open.
  - Mark-read: call a slim `order-messages-mark-read` action (or reuse the existing edge function once it targets Cloud), then invalidate `nav-badges` and `unread-order-messages`.
- Add a Cloud `notifications` dedupe / short-circuit for `order_message_*` when the recipient already has an unread notification for the same `related_order_id` in the last 60s so a burst of messages doesn't trigger repeat pushes.

### 6. Verify

- Sign in as jcsbh on device, register push, sign out, sign in as sarahhearn2, confirm only sarahhearn2's row exists for that endpoint. Send a test push to each user and confirm only the signed-in user receives it.
- Open a support thread with unread messages: badge on Contact Support button clears within 1s of open and stays cleared on background/foreground.
- Open an order chat: initial paint < 300 ms after cache hit, messages send without waiting on edge function, badge clears on open.
- Send a single order/support message from another account: exactly one alert surfaces (either OS banner or sonner, not both).

## Technical notes

- New edge function: `unregister-push-subscription` (POST `{ endpoint }`, auth required, deletes matching `push_subscriptions` row for the caller's user_id).
- `register-push-subscription`: extend the iOS cleanup query to also `.delete().eq('endpoint', endpoint).neq('user_id', userId).eq('platform','ios')`.
- `order-messages/index.ts`: replace `EXTERNAL_PUBLIC_URL` / `EXTERNAL_SERVICE_ROLE_KEY` usage with Cloud env; delete the fallback branch; keep the schema-resilient insert retry.
- `ChatConversation.tsx`: switch mark-read to `invokeCloudFunction('mark-chat-thread-read', { body: { thread_id } })`; add unmount invalidation.
- `RealtimeAlerts.tsx`: add a `SUPPRESSED_ON_NATIVE` set for push-backed types and early-return for those when `Capacitor.isNativePlatform()`.
- `AuthContext.signOut`: fire-and-forget `invokeCloudFunction('unregister-push-subscription', { body: { endpoint: lastToken } })` before `supabase.auth.signOut`, with a 1.5s timeout so sign-out is never blocked.

No changes to `capacitor.config.ts`, status bar, footer, splash, or Apple Pay code.
