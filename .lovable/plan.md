## Problem

Opening/closing a Drawer, Sheet, Dialog or AlertDialog causes a visible flash / glitch on the native status-bar strip. This is separate from the earlier colour-match issue — the flash happens regardless of what colour we pick.

## Root cause (verified in `src/lib/appChrome.ts`)

With `StatusBar.overlaysWebView: false`, the iOS status bar is a **separate native strip above the WebView**. Every time an overlay opens or closes we call `StatusBar.setBackgroundColor(...)` inside a 60ms `setTimeout`. That produces two visible artefacts:

1. **Timing mismatch.** Radix animates the backdrop opacity from 0 → 50% over ~150ms. The native strip is instead re-painted in a single frame after a 60ms delay, so during opening you see the strip snap-dim while the WebView is still fading, and during closing the strip snap-restores before the backdrop finishes fading. This reads as a flash right under the Dynamic Island.
2. **Colour re-composition on every open/close.** `overlayTint()` recomputes the dim from `--foreground` every call. On close, `setBackgroundColor` briefly repaints the strip before the WebView backdrop is gone, causing a second flicker.

We cannot make the native strip's colour animation match Radix's CSS opacity transition — they're two different rendering pipelines.

## Fix

Stop animating the native status bar at all. Make the WebView extend under the status bar so the Radix backdrop (which already covers the full WebView) naturally dims the status-bar area — no native colour changes, no timing mismatch, no flash.

### Changes

**`capacitor.config.ts`**
- `StatusBar.overlaysWebView: true` (was `false`). Keep `style: 'DARK'`, drop the `backgroundColor` key (irrelevant in overlay mode).

**`src/lib/appChrome.ts`**
- Delete `syncNativeStatusBar`'s colour toggling. Keep the function but reduce it to a **one-time** call that sets `StatusBar.setOverlaysWebView({ overlay: true })` and `StatusBar.setStyle({ style: Style.Dark })` on first invocation. Never call `setBackgroundColor` again.
- Remove `overlayTint`, `hslTripleToHex`, `hexToRgb`, `dimColor` — no longer needed.
- `pushOverlayAppChrome` / `restoreRouteAppChrome` keep their ref-counting but only update the web-side `--app-top-bg` / meta tags (they already do). No native calls.

**`src/index.css`**
- The existing `body::before` pseudo-element (lines 124-135) already paints an `env(safe-area-inset-top)` strip in the route colour above the WebView content. Because it's `position: fixed; z-index: 45`, it sits **below** Radix overlays (which use `z-50`). This means when a drawer opens, the Radix `bg-foreground/50` backdrop covers this strip too — producing the dim under the Dynamic Island automatically, in perfect sync with the rest of the backdrop's fade animation. No changes needed here; this is why the fix works.
- Verify no page adds `padding-top: env(safe-area-inset-top)` that would double-count. If any page (e.g. `Auth.tsx`, `Index.tsx` header) does, they already account for the strip via the pseudo-element and don't need changes. If a page's top content collides with the status bar after switching to overlay mode, add `pt-[env(safe-area-inset-top)]` to that page's top container only.

### What we deliberately don't touch

- Drawer / Sheet / Dialog / AlertDialog components — unchanged.
- `useOverlayChrome` — unchanged (still ref-counts for the web-side chrome).
- Footer padding, drawer heights, `pb-12` on listing footer — all preserved.
- Splash / launch colour `#DDFED7` — unchanged.

## Verification

1. Open a drawer on Settings, ListingDetails, Profile → the dim fades in smoothly across the whole screen including under the Dynamic Island. No flash on open. No flash on close.
2. Open an AlertDialog inside a drawer (e.g. Wishlist remove) → same, no double flash.
3. Route colour on non-overlay screens still shows correctly at the top (the `body::before` cream/lime strip covers the safe-area).
4. WebView does not resize when opening/closing an overlay (regression check).
5. Cold-boot on native to `/auth` — status area reads lime end-to-end, no flash before React mounts.
