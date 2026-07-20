## Goal

Eliminate the flash/glitch at the top of the screen when drawers/sheets/dialogs open and close on native, without moving any layout (WebView stays put, footer buttons stay put, no safe-area padding changes).

## Root cause

In `src/lib/appChrome.ts`:
- `syncNativeStatusBar` debounces `StatusBar.setBackgroundColor` by 60 ms. The Radix `bg-foreground/50` backdrop dims the WebView instantly, but the native status-bar strip changes color ~60 ms later. Same lag on close. That mismatch is the "flash".
- Every `pushOverlayAppChrome` / release also re-runs the full `applyAppChromeColor` path (meta tags, CSS vars, class toggles, body/html background writes). None of that needs to change for overlay transitions and it adds extra reflow work while the drawer is animating.

## Changes (only `src/lib/appChrome.ts`)

1. Split status-bar handling into two paths:
   - Route color changes keep the existing 60 ms debounce (avoids thrash during navigation).
   - Overlay push/pop calls a new `setStatusBarOverlayTint(isOverlay)` that calls `StatusBar.setBackgroundColor` immediately (no timer) with the precomputed tinted or route color. This makes the strip dim in lockstep with the Radix backdrop.
2. Cache the current route color and its precomputed `overlayTint` so overlay push/pop does zero DOM work and zero color math.
3. `pushOverlayAppChrome` / its release no longer call `applyAppChromeColor`. They:
   - Increment/decrement `activeOverlayCount`.
   - Call `setStatusBarOverlayTint(true)` on first push, `setStatusBarOverlayTint(false)` on last release.
   - Do NOT touch `--app-top-bg`, `theme-color`, `app-overlay-chrome` classes, or html/body backgrounds — those already match the route and don't need to move for a dim overlay.
4. `applyAppChromeColor` (route path) recomputes and caches the tint whenever the route color changes, so the next overlay push has the right value ready with no flicker.
5. Keep `setOverlaysWebView({ overlay: false })` behavior exactly as-is (called once, never toggled) so the WebView never resizes.

## Result

- Native status-bar strip transitions dim/undim in the same frame as the Radix backdrop — no visible flash on open or close.
- Nothing in the WebView layout moves: no footer shift, no content jump, no safe-area changes.
- Route color transitions (navigation) still debounced as before.

## Files touched
- `src/lib/appChrome.ts` (only)
