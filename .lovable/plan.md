# Fix persistent support-chat notification badge

## Root cause

The Alerts bottom-nav badge is derived from unread rows in the `notifications` table. Support-chat alerts have two sources that must both be cleared:

- A real `notifications` row (`type = 'support_message'`, `related_thread_id = <thread>`)
- A synthesized fallback in `useNotifications` built from `chat_messages` where `sender_type != 'user'` AND `read = false`

Today:

- Opening the support conversation marks `chat_messages.read = true` but never updates the matching `notifications` row and never invalidates the `['notifications']` query, so the DB-derived badge stays and reappears after any refetch.
- Tapping the alert on the Alerts screen skips `markAsRead` for fallback entries, and the "mark all as read" tap early-returns when only fallback entries are unread — so opening Alerts doesn't clear it either.

## Changes

### 1. `src/pages/ChatConversation.tsx` — clear both sources on open

In the existing `markRead` effect, after updating `chat_messages`:

- Also update `notifications` set `is_read = true` where `user_id = auth user`, `related_thread_id = threadId`, `type = 'support_message'`, `is_read = false`.
- Invalidate `['notifications']` in addition to `['unread-support']` and `['nav-badges']`.

### 2. `src/pages/Notifications.tsx` — don't ignore fallback support items

- Remove the `!n.id.startsWith('fallback-')` guard on the auto "mark all as read" effect so any unread item (including support fallbacks) triggers a clear pass.
- Update `markAllAsRead` in `src/hooks/useNotifications.ts` to also mark the user's support `chat_messages` as read in the same mutation: for every `chat_threads.id` where `user_id = auth uid`, set `chat_messages.read = true` where `sender_type != 'user'` AND `read = false`. This guarantees taps on the Alerts screen clear the fallback source too.
- When an individual fallback support notification is tapped, run the same targeted update on `chat_messages` for that `related_thread_id` (in addition to navigating).

### 3. Verification

- `supabase--read_query`: confirm after opening the support chat that `notifications.is_read = true` for the matching row, and `chat_messages.read = true` for that thread's non-user messages.
- Reopen the native app: the badge should not reappear.

## Scope

Frontend only. No schema, RLS, or edge-function changes. No behavioral changes to any non-support notification type.
