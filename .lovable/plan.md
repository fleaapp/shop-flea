## Root cause

The earlier "transparent status bar so the drawer dim overlay blends across the top" change made the native status bar **permanently** overlay the WebView (`overlaysWebView: true`, always). That means every page renders under the status bar, not just while a drawer/dialog is open. To compensate we then sprinkled `pt-[env(safe-area-inset-top)]` on `#root` and on `fixed inset-0` pages, but:

- `absolute`-positioned top controls (Sales 💸 button on Profile / Seller Profile, close buttons, etc.) don't respect that padding, so they clip on every device with any status bar height.
- `DrawerContent`'s `top-10` (40px) is measured from viewport top, so on any device where `env(safe-area-inset-top)` ≥ 40px (notch/Dynamic Island phones) the drag handle and title hide behind the status bar.
- Behaviour was fine before the status-bar change because the status bar wasn't overlaying the WebView.

## Fix — restore non-overlay by default, only overlay while a dim backdrop is active

This is a one-place native fix that removes all per-page padding hacks and works on every device.

### 1. `src/lib/appChrome.ts` — conditionally toggle `overlaysWebView`
- When `isOverlay === false` (normal pages): call `StatusBar.setOverlaysWebView({ overlay: false })` and `StatusBar.setBackgroundColor({ color: visibleTopColor })`. The status bar becomes a solid strip matching the route colour (cream / lime), and the WebView sits below it, exactly like before the change.
- When `isOverlay === true` (Drawer / Dialog / Sheet / AlertDialog open via `useOverlayChrome`): keep the current behaviour, `setOverlaysWebView({ overlay: true })` with transparent background and `Style.Light`, so the dim backdrop blends over the status bar.
- Remove the "ALWAYS in overlay mode" comment and update to reflect the toggled behaviour.

### 2. `capacitor.config.ts` — start in non-overlay
Change `StatusBar.overlaysWebView` from `true` to `false` so the native default matches the app's default state on cold boot before JS mounts.

### 3. Revert now-unnecessary safe-area padding
Because content no longer sits under the status bar in the default state, the compensating padding causes a double gap. Remove:
- `#root { padding-top: env(safe-area-inset-top) }` in `src/index.css` (if it was added specifically for this).
- `pt-[env(safe-area-inset-top)]` on the `fixed inset-0` containers in `src/pages/Profile.tsx` (lines 170 and 424), `src/pages/SellerProfile.tsx` (line 278), `src/pages/Index.tsx`, `src/pages/Favorites.tsx`, `src/pages/SuggestionBox.tsx`, `src/pages/ContactSupport.tsx` (whichever pages received the earlier patch).
- Restore any `pt-safe` / equivalent that was removed in `CreateListing.tsx`, `SellerDashboard.tsx`, `AdminHeader.tsx` **only if** they visually regress; check each after step 1 lands.

### 4. `src/components/ui/drawer.tsx` — safe-area-aware drawer offset
Even in non-overlay mode, once a drawer opens the status bar flips to overlay, so `DrawerContent`'s viewport-top offset must clear the inset. Change `top-10` to an inline style:

```tsx
style={{ top: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
```

Falls back to 24px on devices with no inset (behaves like the current `top-10` visually on non-notch devices, safely below Dynamic Island on notch devices).

Auth-related sheets already use the same overlay chrome, so no separate change needed for Dialog/Sheet/AlertDialog — their content is already vertically centred or bottom-anchored.

### 5. Auth-page logo
Revert `src/pages/Auth.tsx` line 401 back to its original `top-20 max-[375px]:top-12` (drop the `calc(env(safe-area-inset-top,0px) + …)` we added last turn). With the status bar no longer overlaying, the original values position correctly again across all devices.

## Verification checklist

Preview on multiple viewports (iPhone SE 375px, iPhone 15 393px, iPhone 17 Pro Max 440px, and desktop):
- Profile / Seller Profile: Sales 💸 button fully visible, tappable, badge not clipped.
- Home, Favorites, Notifications, Suggestion Box, Contact Support, Create Listing, Seller Dashboard: no double top gap, no clipped headers or back buttons.
- Auth / Forgot Password / Reset Password / Verify Email: logo at correct height, not too high, not too low.
- Open any Drawer (Filter, Shipping Settings, Order details, Sales Details, Admin drawers): drag handle and title fully visible below the status bar; dim backdrop still blends across the status bar area (transparent overlay while open); status bar returns to solid route colour on close.
- Open any Dialog / AlertDialog / Sheet: same dim-blend behaviour, no layout regression.
- Confirm on cold boot (native) there's no cream flash before /auth redirect (auth chrome logic in `appChrome.ts` still runs first).