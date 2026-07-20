## Diagnosis

Sarah has 3 identical `payment_action_required` notifications (13:40:41, 13:40:55, 13:41:37 — within ~1 min). They come from `supabase/functions/stripe-webhook/index.ts` in the `account.updated` handler (lines 257–263): every time Stripe fires an `account.updated` webhook while the seller isn't fully verified AND has a `disabled_reason`, it inserts a new notification.

During Stripe Connect onboarding, `account.updated` fires many times in rapid succession (each requirement collected triggers an update), so sellers get several duplicate "Seller account needs attention" alerts.

Memory already promises this notification is "rate-limited to 24h" — but that rate limit was never actually implemented in the webhook.

## Fix

In `supabase/functions/stripe-webhook/index.ts` `account.updated` handler, before inserting a `payment_action_required` notification, check whether one already exists for this user within the last 24 hours. If yes, skip both the DB insert and the push.

Concretely:

1. Query `notifications` for the most recent row with `user_id = profile.user_id` and `type = 'payment_action_required'`.
2. If `created_at` is within the last 24h, skip the `notify(...)` call entirely.
3. Otherwise, proceed as today.

Also apply the same 24h dedupe to the `seller_verified` success notification in the same handler so a flapping account state can't spam that either.

Cleanup for Sarah's existing duplicates: delete the 2 older duplicate `payment_action_required` notifications for her user (`6b0dd9d6-dee9-4f6d-8d4f-d3c191404c0b`) via a one-off migration so she immediately sees only 1.

## Technical details

- File: `supabase/functions/stripe-webhook/index.ts` — add a small `wasNotifiedRecently(userId, type, hours)` helper using `serviceClient.from('notifications').select('created_at').eq(...).order('created_at', {ascending:false}).limit(1)` and gate the two `notify()` calls in the `account.updated` case.
- Migration: `DELETE FROM public.notifications WHERE user_id = '6b0dd9d6-dee9-4f6d-8d4f-d3c191404c0b' AND type = 'payment_action_required' AND id <> '72e28a2c-d283-488e-bc2f-53fd79c01993';` (keep the newest one from 13:41:37).
- No client changes. No schema changes. Existing `Notifications.tsx` behavior unchanged.
