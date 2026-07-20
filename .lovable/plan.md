## Fix footer badge flashing + mark alerts as read on open

### Problem 1 — Badges flash between screens
`BottomNav` mounts fresh on every route change and its badge sources (`useNavBadges`, `useNotifications`, `useOrders`, `useUnreadOrderMessages`) each re-run their initial state:

- `useNavBadges` uses `staleTime: 0` + `refetchOnMount: 'always'` with no `placeholderData`, so on every nav the query returns `EMPTY` (all zeros) for one render before the cached/refetched data comes back → badges briefly disappear then re-appear.
- `useNotifications` computes `badgeCount` from `badgeDismissedAt`, which is initialized to `null` via `useState(null)` and only populated inside a `useEffect`. On mount, `badgeDismissedAt` is `null` for the first render → `badgeCount` returns `notifications.length` (full unread) → next tick it flips to the correct "since-dismissed" count. That's the visible flash on the Alerts badge.

### Problem 2 — Opening Alerts doesn't mark notifications as read
`Notifications.tsx` only calls `dismissBadge()` (a localStorage timestamp that hides the red count). It never sets `is_read = true` in the DB, so:

- Individual green unread dots stay on every card until the user taps each one.
- Any downstream logic that reads `is_read` (push, other clients, future badge sources) stays "unread".

### Changes

**`src/hooks/useNotifications.ts`**
- Lazy-init `badgeDismissedAt` from `localStorage` in `useState(() => …)` so the first render already has the correct value — no null → value flash.
- Keep the existing `useEffect` for when `user?.id` changes later.

**`src/hooks/useNavBadges.ts`**
- Add `placeholderData: (prev) => prev` (keepPreviousData) so navigating between screens keeps the last known counts visible while the refetch runs, instead of momentarily returning `EMPTY`.
- Keep `refetchOnMount: 'always'` and realtime invalidation unchanged.

**`src/pages/Notifications.tsx`**
- On mount, in addition to `dismissBadge()`, call `markAllAsRead.mutate()` so every DB-backed notification for the user is flipped to `is_read = true`. This clears the green unread dots and any cross-device unread state the moment the Alerts screen is opened.
- Guard the call so it only fires when there is at least one unread notification (avoid pointless writes on every visit).

### Out of scope
- No visual/UI redesign of the badges or Alerts screen.
- No changes to notification content, push delivery, or how individual card taps behave.
- Cart / Profile / Settings badge math (orders to ship, unread order messages, support) is unchanged — they'll simply stop flashing because their source hook now keeps previous data across navigation.
