## Root cause

Push notifications never arrive because the `public.push_subscriptions` table has **zero table grants**. RLS is enabled, policies exist, but with no `GRANT` to `authenticated` the Data API rejects every insert from the app. Verified:

- `send-push-notification` logs show `No subscriptions found for user: <sarahhearn2>` — the trigger fires and the edge function runs correctly.
- `SELECT count(*) FROM push_subscriptions` = **0** across every user.
- `information_schema.role_table_grants` for `push_subscriptions` returns no rows.

So both web (`usePushNotifications`) and native iOS (`useNativePushNotifications`) upserts silently fail with permission-denied, no token is ever stored, and every downstream push (comments, sales, messages, refunds, mentions, reminders) has nothing to deliver to. The in-app sonner alert still works because it reads directly from Realtime on `notifications`.

## Fix

Add a migration that grants the standard Data API privileges on `public.push_subscriptions`:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
```

RLS + existing policies already restrict rows to `auth.uid() = user_id`, so this only unblocks the legitimate self-owned writes.

## Verify

1. Re-open the app on @sarahhearn2's device so `useNativePushNotifications` re-registers.
2. Query `SELECT user_id, platform, updated_at FROM push_subscriptions` — expect an `ios` row for her user id.
3. Post a comment from @jcsbh and confirm the APNs push arrives; check `send-push-notification` logs show `Found 1 subscription(s)` and `APNs …` success.

No client code changes needed — the hooks are already correct.
