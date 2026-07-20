## Root cause

In `src/lib/appChrome.ts`:
- `cachedRouteTint` is initialized to `APP_TOP_COLOR` (cream `#F5F1EB`).
- It's only recomputed inside `applyAppChromeColor` when `routeTopColor !== cachedRouteColor`.
- On first paint (and any subsequent call while on an app route) `routeTopColor` already equals `cachedRouteColor` (both cream), so the condition is false — `overlayTint()` never runs and `cachedRouteTint` stays cream.
- When a drawer opens, `setStatusBarOverlayTint(true)` reads `cachedRouteTint` and paints the native status bar strip cream. The Radix `bg-foreground/50` backdrop dims the WebView area below the strip, so the strip visibly stays cream while everything under it goes dim — exactly what the screenshots show.

## Fix (only `src/lib/appChrome.ts`)

- Remove the `if (routeTopColor !== cachedRouteColor)` guard around the tint computation. Always keep `cachedRouteColor` and `cachedRouteTint` in sync with the current route colour on every `applyAppChromeColor` call. Recomputing a small hex mix on route changes is cheap and guarantees the tint is ready before the first overlay push.
- As a safety net, if `setStatusBarOverlayTint(true)` is ever called before `applyAppChromeColor` has run, compute the tint on the fly from the current route colour instead of trusting the stale cache.

No other changes: overlay push/pop stays immediate, route path stays debounced, `overlaysWebView` stays permanently `false`, layout doesn't move, footer buttons don't shift.

## Result

- Native status-bar strip dims to the composited `foreground @ 50%` over cream in the same frame as the Radix backdrop — no more cream strip above the dim.
- No flash on open/close. No layout movement.

## Files touched
- `src/lib/appChrome.ts` (only)
