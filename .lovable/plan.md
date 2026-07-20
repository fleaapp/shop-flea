## Root cause

In `src/lib/appChrome.ts`, when a Drawer/Sheet/Dialog/AlertDialog opens, `pushOverlayAppChrome()` flips the native status bar into overlay mode:

```ts
StatusBar.setOverlaysWebView({ overlay: true })
```

and flips it back to `overlay: false` when the overlay closes. Each toggle resizes the WebView by the status bar height (~54px on iPhone 17 Pro Max), which is exactly the "glitch/jump near the status bar" visible in the recording. The status bar `Style` is also switched (`Light` ↔ `Dark`), causing a second visible flicker.

Everything else about the current chrome (footer padding, drawer heights, safe-area handling) is already in the shape the user is happy with — the only offender is the overlay-mode toggle.

## Fix

Stop toggling `overlaysWebView` when overlays open/close. Keep the WebView layout stable and dim only the status-bar strip's colour instead.

### Changes to `src/lib/appChrome.ts`

1. `syncNativeStatusBar`
   - Remove the `if (isOverlay) { setOverlaysWebView(true) … } else { setOverlaysWebView(false) … }` branch.
   - Always keep `setOverlaysWebView({ overlay: false })` (call it once on first sync, then skip if unchanged).
   - Always keep `StatusBar.setStyle({ style: Style.Dark })` — do not switch to `Light` on overlay.
   - When `isOverlay` is true, set `StatusBar.setBackgroundColor` to a pre-computed dimmed version of the current route top colour (mix route colour with black at ~40% opacity, matching the Radix backdrop `bg-black/40`) so the status-bar strip visually dims in sync with the sheet backdrop — with no resize.
   - When `isOverlay` is false, restore the plain route colour.

2. `applyAppChromeColor`
   - Stop writing `--app-top-bg` / `documentElement.backgroundColor` / `body.backgroundColor` to the transparent overlay value (`#00000000`) while an overlay is open. Keep them on the route colour so the WebView never repaints its top strip; only the native status-bar background changes.
   - `app-overlay-chrome` class and `color-scheme` toggling: leave the class in place for any CSS that still targets it, but do not change `colorScheme` (keeps light mode stable).
   - `meta[name="theme-color"]`: keep pointed at the route colour, not the transparent overlay value, to avoid PWA header flashes on the same code path.

3. `pushOverlayAppChrome` / `restoreRouteAppChrome`
   - Keep the ref-count logic. It now only drives the status-bar background dim, not an overlay-mode toggle.

Nothing else changes: drawer/sheet/dialog components, footer padding (`pb-8` / `pb-12` etc.), `h-full` on `ListingDetails` drawer, safe-area handling, and `capacitor.config.ts` (`overlaysWebView: false`) all stay exactly as they are today.

## Verification

- Native build: open Home → Listing drawer, Wishlist → remove confirmation, Seller Onboarding sheet, Settings → any sheet. Status bar strip dims to a darker tone as the backdrop appears, then restores; no vertical jump, no content shift, no icon-style flicker.
- Footer buttons on all drawers remain in the position established last iteration (unchanged).
- PWA/web: unaffected (native-only code paths).
