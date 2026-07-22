## Diagnosis confirmed
- The latest comment test created the in-app notification for `@sarahhearn2`.
- The push sender function did run for that same notification.
- The push sender still found **zero saved push subscriptions** for `@sarahhearn2`.
- The token registration function has **no recent calls at all**, so this is not a PWA-to-native issue and not yet an APNs delivery failure. The native app is not reaching the backend to save its device token.

## Plan
1. **Fix the native registration call path**
   - Update push token registration to use the same auth client/session source as the rest of the app.
   - Remove the fragile split between `src/lib/supabase` and the generated cloud client for this call so the Authorization token is reliably attached.
   - Add a direct fallback `fetch` to the registration function if `functions.invoke()` does not execute in native WebView.

2. **Add a visible in-app push health check**
   - On native iOS after login/open/foreground, log clear states for: permission status, APNs registration attempted, APNs token received, backend save attempted, backend save success/failure.
   - Send failures to the admin error logs so we can see device-side problems even when Xcode is not attached.

3. **Keep the sender-side push path explicit**
   - Keep comment/reply push sends tied to the matching in-app notification row, so one in-app alert equals one push attempt.
   - Add the same explicit send pattern to any notification types that still only create in-app alerts and rely on a missing/disabled trigger.

4. **Verify with real data**
   - Confirm `@sarahhearn2` gets a row in `push_subscriptions` after reopening the native app.
   - Re-test `@jcsbh` commenting on `@sarahhearn2`’s listing.
   - Confirm the push sender logs show an iOS subscription count greater than zero and no “No subscriptions found” warning.

## Important note
The current evidence says the sender being on PWA and recipient being on native is fine. The blocker is that the native recipient has not saved an APNs token into the database.