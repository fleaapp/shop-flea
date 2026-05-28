## What's happening

The splash screen is lime green (`#DDFED7`). The auth screen is lime green. But for ~100–300ms in between, the screen flashes cream (`#F5F1EB`).

Cause: the inline boot script in `index.html` and `src/main.tsx`/`appChrome.ts` decide background color from `window.location.pathname`. On native cold boot, the WebView opens at `/` (not `/auth`), so the "default app top color" (`#F5F1EB` cream) is painted on `<html>` and `<body>` immediately. React then mounts, AuthContext resolves "no session", redirects to `/auth`, and only then `appChrome` repaints lime. The gap between WebView paint and that redirect is the cream flash.

This only happens on native because on web the user is usually already on `/auth` URL when refreshing, and the native WebView's own background is also set to cream-ish via the OS, so the seam is more visible.

## The fix

Make the "before-React" background match the splash (`#DDFED7`) on native, so there is nothing to flash between. On web, keep the current behavior (cream default, lime on auth) so nothing changes for browser users.

### Changes

1. **`index.html` inline boot script** — extend the route check so that when the app is running inside Capacitor (`window.Capacitor?.isNativePlatform?.()` or `location.protocol === 'capacitor:'`) AND the user is not yet signed in (no Supabase auth token in localStorage), default the top bg to lime `#DDFED7` instead of cream. This paints lime on `<html>`, `<body>`, theme-color, and `--app-top-bg` before React mounts.

   Detection for "logged out" pre-React: check `localStorage` for the Supabase auth key (`sb-<project-ref>-auth-token`). If absent → user will land on `/auth` → paint lime. If present → user will land in-app → paint cream as today.

2. **`src/lib/appChrome.ts`** — mirror the same logic in `getRouteTopColor()`: when native + no auth token + pathname is `/`, treat it as auth-like and return lime. This prevents React's first paint from briefly setting cream before the redirect to `/auth` runs.

3. **`capacitor.config.ts`** — already has `ios.backgroundColor: '#DDFED7'`, so the native WebView container is already lime. No change needed there.

4. **No change** to `LaunchScreen.storyboard`, splash plugin config, or auth page itself.

## Result

Cold boot on iOS: lime launch screen → lime WebView container → lime HTML/body (pre-React) → lime auth screen. No cream frame anywhere in the sign-in flow. Web users and already-signed-in native users see no behavioral change.
