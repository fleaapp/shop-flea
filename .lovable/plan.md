### What I confirmed
- The PWA/native split is not the cause. A PWA user can trigger a push to a native user.
- The latest comment alert exists in the database for `@sarahhearn2`, so the in-app notification path is working.
- The push sender ran and logged: `No subscriptions found for user`, meaning `@sarahhearn2` has no saved native push token in the backend.
- The fix should focus on native token registration, not the comment notification itself.

### Plan
1. **Make native token registration more reliable**
   - Ensure the native push registration component is mounted globally after login.
   - Re-register the APNs token on app open, login, and foreground resume, even if the hook thinks it already registered earlier.
   - Avoid relying on a one-time in-memory flag that can get stuck after a failed save.

2. **Add visible failure handling for native push setup**
   - If APNs permission is granted but token save fails, log a clear error to the existing live error logging system.
   - Keep the user-facing experience quiet unless permission is denied or unavailable.

3. **Harden backend token registration**
   - Keep the service-role save path for `push_subscriptions`.
   - Add clearer backend logs for: unauthorized token save, missing endpoint, save failure, and successful save.
   - Confirm `platform = ios` rows are stored for native devices.

4. **Add a small admin/debug signal**
   - Add enough logging to confirm whether a user has zero push subscriptions, web subscriptions, iOS subscriptions, or stale iOS tokens.
   - This will make future “in-app only, no push” issues immediately diagnosable.

5. **Verify after implementation**
   - Check backend logs for successful `register-push-subscription` after `@sarahhearn2` opens the native app.
   - Check `push_subscriptions` has an `ios` row for `@sarahhearn2`.
   - Re-test comment push from `@jcsbh` to `@sarahhearn2` and confirm the push sender attempts APNs delivery instead of saying no subscriptions.

### Expected result
After `@sarahhearn2` fully closes and reopens the native app once, the app should save an iOS push token, and comment pushes from `@jcsbh` should be delivered to the native device.