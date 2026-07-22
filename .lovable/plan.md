## Problem

The bottom-nav Alerts badge is driven **entirely by localStorage**, not by the database's `is_read` state. `useNotifications.badgeCount` compares `notification.created_at` against `flea_alerts_seen_${user.id}` from `localStorage`. When that key is absent (fresh install, PWA reinstall, cleared storage, second device, private tab, first login on that device) the fallback is `notifications.length` — i.e. the full unread count. This is why the badge "resets" on login.

Meanwhile the DB already has authoritative `is_read` per row, and `useNavBadges` already returns `activity_unread` (a DB-backed unread count) — it just isn't wired into `BottomNav`, which prefers the fragile localStorage value.

Confirmed by reads this turn:
- `src/hooks/useNotifications.ts:276-315` — badge logic based on localStorage only.
- `src/components/BottomNav.tsx:34,64,95` — bottom nav consumes `useNotifications.badgeCount`, not `useNavBadges.activity_unread`.
- `src/pages/Notifications.tsx:67-77` — Alerts screen calls both `dismissBadge()` and `markAllAsRead.mutate()`.
- `get_nav_badges` SQL returns `activity_unread = count(notifications where is_read=false)`.
- No `signOut` path clears `flea_alerts_seen_*`, so the issue is fresh-storage, not deletion.

## Plan

### 1. Make the DB the single source of truth for the Alerts badge

- In `src/hooks/useNotifications.ts`:
  - Replace the localStorage `badgeDismissedAt` machinery with `badgeCount = notifications.filter(n => !n.is_read).length`.
  - Keep `dismissBadge` exported as a thin wrapper that calls `markAllAsRead.mutate()` (backwards compatible — `Notifications.tsx` still calls it in a `useEffect`).
  - Remove the `flea_alerts_seen_*` localStorage reads/writes and the `alerts-badge-dismissed` custom event.
- `BottomNav` keeps consuming `badgeCount`; the value is now DB-backed and survives logout/login on any device.
- Realtime already invalidates the `notifications` query on INSERT (`RealtimeAlerts`) and on any change (`useNavBadges` channel) — badge updates live.

### 2. Fix the transient "full count" flash on first mount

Even after fix #1, there's a moment where `notifications` is still loading and `.length` is 0 or a stale value. Gate the badge:

- Return `badgeCount = isLoading ? (previousBadgeCount ?? 0) : unreadFromDb`. React Query's `placeholderData: (prev) => prev` pattern (already used by `useNavBadges`) is applied to the notifications query too, so navigating between screens doesn't flash.

### 3. Ensure `is_read` writes work + realtime replication

- Confirm RLS `UPDATE` policy on `notifications` scopes to `auth.uid() = user_id` (verified this turn — it does).
- Verify `notifications` is in the `supabase_realtime` publication so `RealtimeAlerts` and `useNavBadges` receive events. If missing, add via migration:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  ```
  (Only if not already present; check first with `pg_publication_tables`.)

### 4. Notification duplicate / consistency audit

Review each generator to make sure each real-world event produces exactly one notification per recipient. Fix only what's actually wrong; no behavior change otherwise.

- **`item_sold`** — triggered by `notify_users_on_listing_sold` on `orders` insert. Confirm the trigger fires only for the *first* order row per checkout group (currently it fires per-order, which means multi-item checkouts create N `item_sold` alerts for the seller). Change to dedupe by `order_group_id` if present.
- **`order_message_seller` / `order_message_buyer`** — one per `order_messages` insert. Correct as-is.
- **`support_message`** — trigger inserts one per non-user chat message. The `useNotifications` query *also* synthesises `fallback-support-*` entries from unread chat messages. Guard so we don't render both when a real DB row exists (the current `hasExistingSupportNotification` check only looks at unread rows — extend it to consider read rows too, so re-opening after read doesn't re-inject a fallback).
- **`refund_initiated`** — DB shows two rows for the same seller within the same minute (`09:07:25` and `09:58:08`). Likely the refund edge function is called twice on retry. Add an idempotency guard: skip insert if a `refund_initiated` for the same `related_order_id` was written in the last 60s.
- **`payment_action_required`** — already rate-limited to 24h per project memory; leave alone.
- **`new_comment` / `comment_reply` / `mention`** — one per comment; `create_mention_notifications` already skips self-mentions and caps at 10. Leave alone.
- **`order_shipped` / `order_delivered`** — one per status transition via `notify_on_order_status_change`. Correct.

### 5. Read-state UX polish

- `Notifications.tsx` currently calls `markAllAsRead.mutate()` on every mount even when nothing is unread. Guard on `unreadCount > 0` to avoid the unnecessary write + invalidate round-trip that briefly bumps and re-clears the badge.
- Per-notification tap already calls `markAsRead` — leave.

### 6. Regression check

- Log in on account A, open Alerts, log out, log in on account B on the same device: A's badge should not appear for B (query is keyed by `user.id`, always was — verify).
- Fresh browser / private tab / reinstall: badge should reflect actual DB unread count, not the total.
- Receive a new notification while on any screen: badge increments live via realtime.
- Open Alerts: green dots and badge both clear; DB `is_read` set to true; on next login the badge stays cleared.

## Technical notes

Files edited:
- `src/hooks/useNotifications.ts` — swap badge source to `is_read`; keep `dismissBadge` name for compatibility; guard `markAllAsRead` on `unreadCount > 0`.
- `src/pages/Notifications.tsx` — keep `dismissBadge` call (now a no-op alias) or drop the `useEffect` entirely; skip the always-mark-read pattern.
- `src/hooks/useNotifications.ts` — extend `hasExistingSupportNotification` to include read rows.
- `supabase/functions/...` refund emitter (whichever writes `refund_initiated`) — add 60s idempotency check.
- `supabase/migrations/*` — if needed, add `notifications` to `supabase_realtime` publication.
- Trigger `notify_users_on_listing_sold` — dedupe `item_sold` by `order_group_id`.

No UI/layout changes; badge count number style is unchanged.
