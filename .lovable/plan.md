## Problem

On the newest build, Profile / Cart / other pages render content *under* the iOS status bar / Dynamic Island — avatar clipped, Cart/Orders tabs clipped, back buttons in the notch area become un-tappable.

Root cause (from `git log`): commits `0493c565` (Jul 14) and `575ff8d5` (Jul 12) made the native status bar **always** a transparent overlay so the page background (cream, lime, or the dim drawer/dialog backdrop) shows through it. That is the behavior you asked for and we want to keep. What was missed at the time: with `overlaysWebView: true` always on, the webview extends into the notch, and pages must add `env(safe-area-inset-top)` padding themselves. Most pages (`Profile.tsx`, `Cart.tsx`, `SellerProfile.tsx`, and others) never did, so their top rows sit under the status bar on tall notches (iPhone 17 Pro Max).

The existing `body::before { height: env(safe-area-inset-top) }` strip *paints* the notch area to match the route color — it does not push content down. That paint layer is what makes the drawer dim / lime auth / cream home blend into the status bar, and it will remain untouched.

## Non-negotiable behavior to preserve

- Native status bar stays a **transparent overlay** at all times (`overlaysWebView: true`, `#00000000` background). Do not change `capacitor.config.ts` or `syncNativeStatusBar` logic.
- When a Dialog / Sheet / Drawer / AlertDialog is open, the dim backdrop must continue to extend visually through the status bar area (currently handled by `applyOverlayAppChrome` + the `body::before` strip painting the route color, with the overlay dim sitting on top via each overlay's `top-[calc(-1*env(safe-area-inset-top,0px))]`). No change here.
- Icon style still flips (`Style.Light` while overlay is open, `Style.Dark` otherwise). No change.
- Auth / splash lime chrome, cream in-app chrome, and route color transitions stay exactly as they are.

## Fix

Push page content below the notch **without** touching the status bar transparency.

1. **`src/index.css`** — add `padding-top: env(safe-area-inset-top)` to `#root`. This shifts every non-fixed route below the status bar automatically. The `body::before` paint strip stays, so the visible color under the status bar is unchanged.

2. **Full-screen `fixed inset-0` pages** — these ignore `#root` padding, so add `pt-[env(safe-area-inset-top)]` to the outer wrapper on each. Confirmed target: `src/pages/Profile.tsx` (line 170). During build I'll grep for other `fixed inset-0` page roots with header content (e.g. some sheets/support pages) and pad only the ones with a header row.

3. **Remove now-redundant top padding** to avoid double-padding after step 1:
   - `src/pages/CreateListing.tsx` — 3 occurrences of `pt-[env(safe-area-inset-top)]` on `min-h-screen` wrappers.
   - `src/pages/SellerDashboard.tsx` — `pt-safe` on the header row (its wrapper is `min-h-screen`).
   - `src/components/admin/shell/AdminHeader.tsx` — `pt-[calc(env(safe-area-inset-top)+12px)]` → `pt-3`.
   - `src/components/SearchSheet.tsx` — simplify the two `env(safe-area-inset-top)` paddings (this one may still need its own since it's a portal-mounted sheet; verify during build).
   - `src/pages/Auth.tsx` — uses `fixed inset-0`, so its own `pt-[env(safe-area-inset-top)]` stays.

4. **Do NOT touch**:
   - `capacitor.config.ts` StatusBar / overlay config.
   - `src/lib/appChrome.ts` overlay chrome logic.
   - `body::before` safe-area paint strip.
   - Dialog / Drawer / Sheet / AlertDialog overlays that already use `top-[calc(-1*env(safe-area-inset-top,0px))]` to bleed dim into the notch.

5. **Verify** — Playwright at 430x932 viewport with a simulated `env(safe-area-inset-top: 59px)` override; screenshot Home, Profile, Cart, Seller Profile, Admin Settings, Create Listing, and a route with an open Drawer. Confirm: (a) headers/back buttons sit fully below the notch, (b) the drawer dim still extends into the notch area, (c) no double padding anywhere.

## Files touched

- `src/index.css`
- `src/pages/Profile.tsx`
- `src/pages/CreateListing.tsx`
- `src/pages/SellerDashboard.tsx`
- `src/components/admin/shell/AdminHeader.tsx`
- `src/components/SearchSheet.tsx` (only if verification shows it's needed)
- Any additional `fixed inset-0` full-screen page found during a targeted audit
