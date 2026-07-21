## Problem

With `overlaysWebView: true` + `contentInset: 'always'` and no safe-area padding on the app shell, the WebView draws edge-to-edge but our top UI (FLEA logo, page headers like "Profile", Cart/Orders tabs, notifications bell) sits *behind* the Dynamic Island / notch and gets clipped — exactly what the screenshots show.

Booking.com's effect works because their status-bar area is transparent (WebView + backdrop show through) **and** their interactive top chrome is padded down by `env(safe-area-inset-top)`. We currently have the first half but not the second.

## Fix

Keep the transparent edge-to-edge status bar (no visual/color change, drawers still dim through it), and reserve the notch height for headers only — so nothing tappable is hidden but backgrounds still extend to the top edge.

1. `src/index.css` — add `padding-top: env(safe-area-inset-top)` to `#root` only on native (gated by `html.is-installed` / Capacitor class), so browser/PWA layout is unchanged. Body background stays cream/lime per route, so the safe-area strip looks identical to the page — nothing "moves" visually except sliding down out from under the notch.
2. Verify no page uses `fixed top-0` chrome that would still clip (Header, sticky page headers like FAQ, Cart tabs, Profile). If any are `fixed`/`sticky top-0`, add `pt-[env(safe-area-inset-top)]` to those specific bars instead of relying on #root padding, so they don't overlap the notch when scrolled.
3. Leave `capacitor.config.ts`, `appChrome.ts`, and drawer dimming untouched — the earlier transparent status bar work stays.

## Technical notes

- The previous "moved elements up off screen" complaint was about a different change (adding a solid strip). This change only pads the top by the exact notch height (`env(safe-area-inset-top)`, ~59px on 17 Pro Max) so headers clear the Dynamic Island. Below the notch, layout is byte-identical.
- Gated to native via `html.is-installed` (already set for Capacitor) so Safari browser and desktop PWA are untouched.
- No changes to the Header component's height, spacing, or padding — only a top offset on the root container (and any `fixed top-0` bars that need to match).

## Out of scope

No changes to status bar color, drawer dim behavior, or any component internals beyond adding the safe-area offset.