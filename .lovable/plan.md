## Plan: keep Google sign-in inside the iOS app

### Problem found
The React click handler already tries to block web OAuth on iOS, but the native Google plugin still uses Google’s default iOS sign-in behavior. On iOS, that can present an external Safari-style authentication session, which is why TestFlight is still leaving the app.

### Fix approach
1. **Replace the iOS Google path with a forced in-app native presentation**
   - Patch the `@capgo/capacitor-social-login` iOS `GoogleProvider.swift` implementation.
   - Configure the underlying Google Sign-In SDK to prefer an in-app browser / in-app auth session where supported.
   - Keep using the native Google SDK result and pass the ID token into backend auth with `signInWithIdToken`.

2. **Fail closed on iOS instead of silently opening Safari**
   - Keep the existing `src/lib/googleSignIn.ts` rule: iOS must not call `signInWithOAuth`.
   - Tighten the plugin detection if needed so a missing native plugin shows an in-app error rather than attempting browser OAuth.

3. **Add diagnostic logging that is safe for TestFlight debugging**
   - Log platform/plugin detection only, not tokens or private data.
   - This will make it obvious whether the shipped iOS build is using the native path or falling back due to stale code/config.

4. **Apple sign-in check**
   - Review the Apple path separately and keep it native-only on iOS if the native bridge is present.
   - Do not convert Apple to web OAuth on iOS.

5. **Native rebuild instructions after code changes**
   - Because this touches a native iOS plugin patch, the fix will only reach TestFlight after pulling the code, reinstalling dependencies so the patch applies, then rebuilding/syncing iOS and uploading a fresh build.

### Files expected to change
- `patches/@capgo+capacitor-social-login+8.3.30.patch`
- `src/lib/googleSignIn.ts` if detection/logging needs tightening

### Important note
A true Google login prompt may still look like an iOS system sheet, but the goal is: no handoff to the Safari app and no web OAuth fallback from the app code.