## Problem

Two separate bugs in the admin settings footer badge:

1. **Misalignment** — `BottomNav` sums only 6 of the 12 admin categories (`support + reports + refunds + brands + contact + bans`), ignoring `suggestions`, `waitlist`, `transactions`, `listings`, `users`, and `errorLogs`. The Admin Dashboard header sums all of them, so the two counts never match.

2. **Flashing / glitching** — `useAdminBadges` subscribes to 9 tables with **wildcard** (no user filter) postgres_changes listeners, including high-churn ones (`chat_messages`, `orders`, `listings`, `notifications`, `profiles`). Every unrelated row change anywhere in the app fires `refresh()`, which round-trips the `admin-data` edge function. Concurrent responses can land out of order, so the badge visibly jumps between values (and briefly to the previous state) several times a second under normal traffic.

## Fix

### `src/components/BottomNav.tsx`
- In `AdminSettingsBadgeProbe`, sum **all** admin categories so the footer matches the dashboard:
  `support + reports + bans + suggestions + waitlist + contact + transactions + refunds + listings + users + brands + errorLogs`.

### `src/hooks/admin/useAdminBadges.ts`
- Add a trailing-debounced `refresh` (≈400ms) so bursts of realtime events collapse into one fetch.
- Add a monotonically increasing request-id guard so late responses can't overwrite fresher state (kills the "jump back" visible flash).
- Drop `notifications` from the subscribed tables — admin categories are derived from source tables (chat_messages, reports, orders, listings, contact_submissions, waitlist, profiles, brands), so the wildcard `notifications` firehose only adds noise.
- Keep the existing `focus` + `admin-last-seen-updated` triggers, but route them through the same debounced refresh.

## Out of scope

No changes to the admin edge function, dashboard counts, or non-admin nav badges. No visual/style changes to the badge itself.