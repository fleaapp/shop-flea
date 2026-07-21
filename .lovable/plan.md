## Two related issues, one root cause

The safe-area padding is currently applied to `#root` (native only). That has two side effects:

1. **Fixed-inset screens ignore it** → Home, Auth, Profile, Seller Profile headers still sit under the Dynamic Island.
2. **Scrollable screens rubber-band** → the lime `body` background shows above and below the padded `#root` when overscrolling (Cart, Alerts, Settings screenshots).

## Fix

Move the safe-area padding off `#root` entirely and apply it per-screen instead, so nothing sits above or below the scrollable content area.

### 1. `src/index.css`
- Remove the `html.is-installed #root { padding-top: env(safe-area-inset-top) }` rule.
- Set `html, body { background: hsl(var(--background)) }` on native so any overscroll bleed matches the app background instead of showing lime.
- Add a native-only utility:
  ```css
  html.is-installed .native-safe-top { padding-top: env(safe-area-inset-top); }
  ```

### 2. Apply `native-safe-top` to the four fixed-inset screens
Confirmed offenders (each uses `fixed inset-0`):
- `src/pages/Index.tsx:505`
- `src/pages/Auth.tsx:392`
- `src/pages/Profile.tsx:170` and `:429`
- `src/pages/SellerProfile.tsx:286`

### 3. Apply `native-safe-top` to the shared flow-layout wrapper
For normal scrollable pages (Cart, Settings, Alerts/Notifications, etc.) add `native-safe-top` to their outermost container so the top of the page starts below the Dynamic Island — instead of adding it to `#root` where it caused the overscroll bleed.

### 4. Prevent overscroll bleed
Add `overscroll-behavior-y: none` on `html, body` under `html.is-installed` so the lime background can't peek in during rubber-band scrolling at all.

## Not changing

- No changes to `capacitor.config.ts` or `appChrome.ts` — status bar stays transparent and edge-to-edge.
- Web/PWA behaviour unchanged (all new rules gated by `html.is-installed`).
- No repositioning of any UI elements beyond restoring the safe-area clearance that already existed before this regression.
