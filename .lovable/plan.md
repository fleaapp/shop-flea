## Goal

Make the native iOS status bar act as a permanent transparent overlay across every screen. The page background (cream, lime, drawer dim, sold-item overlay, etc.) shows through it at all times, matching the dimmed in-app Safari look shown in the reference image. No more solid cream/lime/black bar cutting into drawer content.

Note: this is a native-only change. In the Lovable web preview and mobile Safari, iOS controls the status bar and will still render it solid — the fix is only visible in the Capacitor iOS build after `npx cap sync` and a rebuild in Xcode.

## Changes

### 1. `capacitor.config.ts`
Flip the StatusBar plugin defaults so the app boots into overlay mode instead of a solid lime bar:
- `overlaysWebView: true`
- `style: 'LIGHT'` (dark content on light backgrounds — will be re-set per route at runtime anyway)
- Remove the `backgroundColor: '#DDFED7'` line (transparent overlay has no background)

This kills the cold-boot solid bar before JS mounts.

### 2. `src/lib/appChrome.ts`
Refactor so the native status bar is always in overlay mode; only the CSS "top color band" behind the WebView content changes per route.

- `syncNativeStatusBar(...)` always calls:
  - `StatusBar.setOverlaysWebView({ overlay: true })`
  - `StatusBar.setBackgroundColor({ color: '#00000000' })`
  - `StatusBar.setStyle(...)` picking `Light` on dark/dim backgrounds and `Dark` on light backgrounds
- Remove the `isOverlay` branch that used to toggle overlay on/off — overlay is now permanent.
- `applyAppChromeColor` still writes `--app-top-bg`, `theme-color`, and the html/body background so the WebView paints the correct color under the transparent status bar. This is what makes the status bar visually "match" cream on app screens, lime on auth, and go dim over drawers/sheets automatically (because the drawer's dim backdrop already sits above the page).
- `pushOverlayAppChrome()` / `useOverlayChrome` keep existing behavior but no longer need to flip native overlay state (it's always on). They can just tweak the status bar `style` to `Light` while an overlay is mounted so icons stay readable over the dim backdrop, then restore.
- Keep the existing `activeOverlayCount`, resume listeners, and debounce logic intact.

### 3. iOS safe-area padding sanity check
Because the WebView now sits under the status bar full-time, every top-level screen must already be respecting `env(safe-area-inset-top)`. The app's `Header`, auth screens, and drawer headers use `pt-safe` / safe-area utilities today, so no layout changes are expected — but I'll spot-check `src/components/Header.tsx`, `src/pages/Auth.tsx`, and the drawer header in `src/components/ui/drawer.tsx` after the chrome change and add `pt-[env(safe-area-inset-top)]` only where a screen visibly clips.

### 4. What is NOT changing
- No changes to `SellerDashboard`, checkout, coupons, payouts, verification, or any business logic.
- No changes to the web PWA behavior — browsers ignore the Capacitor StatusBar plugin.
- No changes to splash screen or launch storyboard.

## Verification

1. `npx cap sync ios` + rebuild in Xcode.
2. On device: status bar icons visible over cream home, lime auth, and go dim automatically when any drawer/sheet/dialog opens (because their backdrop paints through the transparent bar).
3. Confirm drawer headers are no longer clipped at the top.
4. Confirm cold boot no longer shows a solid lime bar before React mounts.
