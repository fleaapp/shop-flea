## Diagnosis

The app was originally built for `overlaysWebView: true` (Reels-style, WebView edge-to-edge under the notch) — every overlay in `dialog.tsx`, `sheet.tsx`, `drawer.tsx`, `alert-dialog.tsx` uses `top: calc(-1 * env(safe-area-inset-top, 0px))` to extend up into the notch, and `body::before` already paints the safe-area strip in the route color. It was flipped to `overlay: false` earlier to unclip headers after a plugin regression, which made `env(safe-area-inset-top)` inside the WebView equal to `0`. That's why the tint overlay (height `env(safe-area-inset-top)`) collapses to nothing and the strip stays solid cream.

## Fix (no element moves)

### 1. `src/lib/appChrome.ts` — flip to overlay mode
- Change `StatusBar.setOverlaysWebView({ overlay: false })` → `{ overlay: true }` in both the init inside `syncNativeStatusBarRoute` and in `reassertOverlayFalse` (rename to `reassertOverlayTrue`).
- Drop `StatusBar.setBackgroundColor` calls — with overlay:true the native strip is transparent and irrelevant; the DOM paints it.
- Keep `StatusBar.setStyle(Style.Dark)` and the resume/visibility re-assert path unchanged.

### 2. `src/index.css` — reserve the strip on the shell so content Y stays put
- Add `padding-top: env(safe-area-inset-top)` to `#root` (and `html.boot-auth #root`).
  - Before: WebView starts below the notch, content top = ~59 px from screen top.
  - After: WebView starts under the notch, `#root` is padded by ~59 px, content top = ~59 px from screen top. **Identical visual position.**
- `body::before` already paints that strip in `--app-top-bg` (route color), so the notch shows cream in-app / lime on auth — same as today.
- No changes to per-page headers, no `pt-` additions to any component. Every existing element renders at the same Y.

### 3. Everything else — unchanged
- `useOverlayChrome.ts` timing already correct.
- `#lv-statusbar-tint` overlay is already sized to `env(safe-area-inset-top)` — it will now have real height and cover the notch strip, fading in one CSS transition alongside the Radix/Vaul backdrop.
- All Dialog/Sheet/Drawer/AlertDialog overlays already use negative `top: calc(-1 * env(...))` — they will now naturally extend up to cover the notch too.

## Why nothing moves
- Content: `#root` padding replaces the 59 px the native status bar used to occupy. Net Y offset = 0.
- Chrome color: `body::before` paints the strip the exact route color the native strip currently paints. No color change at rest.
- Overlays: their `top` was already written for overlay:true and was a no-op under overlay:false. Flipping mode activates the design that was intended.

## Out of scope
- No header/page component edits.
- No route color, resume, or drawer timing changes.
- Auto-hide/status-bar-style unchanged.

## Verification
- Open any drawer (Filter Preferences, Sale Details): status-bar strip dims in one motion with the rest of the screen, no cream band, no dark stripe under the notch.
- Close: strip and content undim together, no color flash.
- Cold boot to `/auth`: notch shows lime; navigate into app: notch shows cream. Content elements sit exactly where they do today (back buttons, headers, toasts unchanged).
- Return from native Camera (refund photo, ID verification): `reassertOverlayTrue` runs on resume, headers stay in place, nothing clipped.
