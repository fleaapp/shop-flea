## Root causes (from Xcode logs)

1. `SplashScreen.hide()` is never called — splash only goes away on default timeout, leaving a long green/cream blank window during which any loading UI underneath looks "stuck".
2. Native `App.addListener` and `StatusBar` calls are registered multiple times during boot (visible as duplicate `App addListener` / `setOverlaysWebView` lines), racing the Capacitor bridge before it's ready (`JS Eval error A JavaScript exception occurred`).
3. `main.tsx` runs `resetAppCache()` on every native launch, unregistering the service worker and clearing all caches mid-boot, which makes the first paint slower and amplifies any loading-screen visibility.
4. Several screens still render a full-screen `bg-primary` + `⏳` (`ResetPassword`, `Profile`, `CreateListing`, `EditListing`, `SellerProfile`) which on iOS WKWebView with slow auth boot looks exactly like the user-reported "green hourglass that never goes away".

## Plan

1. Explicitly hide the native splash as soon as React mounts
   - Install/use `@capacitor/splash-screen` and call `SplashScreen.hide()` from `main.tsx` right after `createRoot(...).render(<App />)`, guarded behind `Capacitor.isNativePlatform()`.
   - Remove reliance on the default 1500ms auto-hide; this is what stack-overflow guidance for this exact log message recommends.

2. Stop registering native lifecycle listeners more than once
   - Remove the `CapacitorApp.addListener('resume')` / `appStateChange` registrations from `src/App.tsx` (these are what produced the duplicate `App addListener` calls in your log).
   - Keep one guarded, deduped path inside `src/lib/appChrome.ts` that only attaches when the bridge is actually ready.

3. Stop wiping the cache on every native launch
   - Update the native branch in `src/main.tsx` so it does NOT unconditionally call `resetAppCache()` every time; only clear caches when a real new build is detected (same `flea_build_id` pattern used for web), and never unregister the service worker on native (irrelevant there anyway).

4. Kill the full-screen green-hourglass loading states
   - `ResetPassword`, `Profile`, `CreateListing`, `EditListing`, `SellerProfile` will no longer render `fixed inset-0 bg-primary` + `⏳` as their loading fallback. They'll render the neutral `PageSkeleton` instead, which uses `bg-background` (cream), not lime green. This means even if auth/profile boot is slow on native, the user never sees a frozen green hourglass.
   - Keep `ResetPassword`'s existing 2s safety redirect to `/auth`.

5. Add a clear boot trace for native
   - Keep the existing `[boot]` log and add one log line after `SplashScreen.hide()` resolves and after the first React render, so the next Xcode log will definitively show whether the WebView is stuck on splash, on a loading shell, or on a real route.

## Validation

- Web preview: confirm `/auth` still renders normally and nothing depends on the removed listeners.
- Native: after you pull + `npx cap sync ios` + run in Xcode, the expected log sequence is:
  - `WebView loaded`
  - `[boot] {...}` printed once
  - splash hidden explicitly (no more "automatically hidden after default timeout" warning)
  - a single set of `StatusBar` calls (not three duplicate sets)
  - either the login screen OR the real home — never a permanent green hourglass.

## What you'll run after I implement this

```bash
git pull
npm install
npx cap sync ios
open ios/App/App.xcodeproj
```

Then press Run in Xcode.