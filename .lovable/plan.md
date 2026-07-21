## Bug
Every screen shifts up so the top row (page header, back button, segment pills) draws under the notch/status bar and gets clipped. Fully killing Flea restores it. You noticed it after a refund request.

## Root cause (high confidence)
Refund proof and ID verification both invoke `@capacitor/camera`'s native `getPhoto`. On iOS, when the native camera dismisses, the WebView is briefly re-laid-out and the StatusBar overlay setting can revert to overlay=true, so the WebView's top edge slides under the status bar and `env(safe-area-inset-top)` becomes 0 for the rest of the session. That matches the symptoms exactly: happens mid-session, affects every screen, and only a fresh launch clears it (because `overlaysWebViewInitialized` in `src/lib/appChrome.ts` is a module-level `true` after first boot, so nothing ever re-asserts `overlay:false`).

Today's `restoreRouteAppChrome` runs on `visibilitychange`, `pageshow`, `focus`, and Capacitor `resume`/`appStateChange`, but:
- `syncNativeStatusBarRoute` early-exits when `color === lastAppliedColor`, so the resume reapply is a no-op.
- Even when it runs, it skips `setOverlaysWebView({overlay:false})` because `overlaysWebViewInitialized` is already true.

## Fix (frontend only, no layout changes)

1. `src/lib/appChrome.ts`
   - Add a `reassertOverlayFalse()` helper that always calls `StatusBar.setOverlaysWebView({ overlay: false })` (bypassing the once-only flag) and then re-applies the current route color + style. Wrap in try/catch and no-op off-native.
   - Make `forceRestoreRouteAppChrome()` reset `lastAppliedColor = null` and call `reassertOverlayFalse()` so it always re-pushes the native flag, not just the color.
   - In the existing resume/appStateChange/visibilitychange handlers, call `forceRestoreRouteAppChrome()` instead of `restoreRouteAppChrome()` so returning to the app always re-locks overlay=false.

2. `src/components/RefundRequestDialog.tsx` and `src/components/IdVerificationStep.tsx`
   - Immediately after every `CapCamera.getPhoto(...)` resolves OR throws (finally block), call `forceRestoreRouteAppChrome()`. This closes the specific camera-dismiss window that triggers the regression, without waiting for the OS resume event.

3. Safety net for other native pickers (push permission, share sheet) — no change needed; the resume-listener upgrade in step 1 covers them.

## Verification
- Rebuild in Xcode, request a refund with a camera photo, dismiss, confirm every screen (Home, Orders, Profile, Settings) still shows its top header/back button uncut.
- Repeat with ID verification and by backgrounding via Control Center.
- Confirm the status-bar dimming during drawers still works (activeOverlayCount path unchanged).

## Out of scope
No changes to layout, safe-area CSS, or `capacitor.config.ts`.
