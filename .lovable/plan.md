## Plan

I will treat this as two separate problems:

1. **Restore the web app UI/UX**
   - Revert the accidental web-facing changes from the last “green loader” sweep.
   - Restore affected React pages/components back to the prior UI state, including auth/loading screens, skeleton replacements, toast loading icon, and changed page fallbacks.
   - Do not use preview screenshots as validation for the simulator issue.

2. **Fix the iOS simulator stall at the native boot layer**
   - Keep the fix focused on Capacitor/iOS boot behavior only.
   - Change the Capacitor splash config so the native splash cannot stay forever if JavaScript has not executed yet.
   - Specifically, undo the risky `launchAutoHide: false` behavior and use native auto-hide with a short duration, while keeping JavaScript `SplashScreen.hide()` only as a backup.
   - Keep cache clearing disabled on native because wiping cache during simulator boot can slow or stall first paint.

3. **Remove debug/preview-only artifacts from native boot**
   - Remove the global debug badge/overlay code that was added to `main.tsx`.
   - Keep only minimal Xcode console boot logs so we can confirm whether JavaScript starts.

4. **Final expected local steps**
   - After implementation, you will run:
     ```bash
     git pull
     npm install
     npx cap sync ios
     open ios/App/App.xcodeproj
     ```
   - Then run the simulator from Xcode.

## Why this should address the loop

The current simulator problem is likely being made worse by `launchAutoHide: false`: Capacitor documents that this makes the native splash stay visible until JavaScript manually hides it. If the stall happens before the auth screen and before JS reliably runs, that setting can leave the simulator stuck on the native loading screen forever. The web app should be restored separately and not used as proof of the native fix.