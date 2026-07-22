## What I found

- The latest in-app alert for @sarahhearn2 was created at `08:46:45`, so the notification event itself is working.
- The push function ran immediately after, but logged: `No subscriptions found for user`.
- `push_subscriptions` still has no row for @sarahhearn2 or @jcsbh.
- The table policies exist, but the explicit table grants query still returns no rows, so the previous database grant did not persist or did not apply to the active backend path.

## Plan

1. **Re-apply the missing database grants**
   - Grant authenticated users permission to create, update, read, and delete only their own push subscription rows.
   - Grant backend functions full access so delivery and stale-token cleanup can work.
   - Keep the existing row-level rules in place so users can only manage their own subscription rows.

2. **Add a safer registration path for native push tokens**
   - Create a protected backend function endpoint for saving push tokens.
   - The function will derive `user_id` from the signed-in session, not from caller-supplied data.
   - This avoids future Data API grant or RLS regressions blocking device-token registration silently.

3. **Update app registration hooks**
   - Change iOS native push registration to call the protected token-registration function.
   - Change web push registration to use the same path.
   - Show/log clear errors if token save fails instead of silently leaving the user without push delivery.

4. **Verify after implementation**
   - Confirm grants exist on `push_subscriptions`.
   - Confirm a signed-in token-save request creates a row for the authenticated user.
   - Confirm caller-supplied alternative `user_id` cannot save a token for another user.
   - Check `send-push-notification` logs after a test alert; expected result is `Found 1 subscription(s)` instead of `No subscriptions found`.

## Technical notes

- The delivery function is currently running; the failing point is token persistence, not notification creation.
- This will not fix APNs certificate/key issues if they appear later, but it will unblock the current confirmed failure: no saved push subscriptions.