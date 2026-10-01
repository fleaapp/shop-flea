# Fix "Inactive" showing for people who are actually active

## What's wrong
"Last active" only updates when someone does a **fresh sign-in** (typing a password or picking a Google account). Most people just open the app and stay signed in, so their time never moves. After 10 days they show as "Inactive" even if they used the app minutes ago.

The data confirms this: your test account shows 06:07 today because you just signed in fresh. Your main account doesn't show in the recent list at all, even though you were using it moments ago.

The other statuses come from the same time, so they're wrong in the same way:
- "Active today" / "Active 3 days ago" on profiles and listings
- The short "2 hours" / "Inactive" bubble on cards, cart and wishlist
- The inactive overlay on listings
- Last seen in the admin users list

## The fix
1. **Record real activity.** Update "last active" whenever a signed-in person opens the app or comes back to it, at most once every 5 minutes so it doesn't add cost.
2. **Do it safely on the server.** A small backend action stamps the time for the signed-in person only. Nobody can set someone else's time, or a future time.
3. **Keep the current wording and the 10-day rule.** Only the time behind them changes.
4. **Fix existing accounts straight away.** Anyone whose real last sign-in is newer than their profile time gets corrected now.

## Check
Use account A, switch to account B, then view A's profile and listings from B. A should show "Active today" or "Just now", never "Inactive".

## Technical details
- New `touch_last_active()` SECURITY DEFINER function: `update profiles set last_sign_in_at = now() where user_id = auth.uid() and (last_sign_in_at is null or last_sign_in_at < now() - interval '5 minutes')`. The existing `sync_profiles_public` trigger copies it to the public profile. Grant execute to authenticated.
- Make sure `profiles_update_guard` / `protect_payout_risk_columns` still block clients from writing `last_sign_in_at` directly.
- Call it from AuthContext after the session is restored, on SIGNED_IN, and on `visibilitychange` to visible / Capacitor `appStateChange` active, throttled per user in memory.
- One-off backfill: `profiles.last_sign_in_at = greatest(profiles.last_sign_in_at, auth.users.last_sign_in_at)`.
- Keep the existing auth trigger as it is.
