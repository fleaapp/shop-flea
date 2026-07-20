## Problem

Two issues on the listing detail sheet:

1. **Gap under the footer buttons.** The sticky footer uses `pb-8` (32px). With `overlaysWebView=false` the webview already stops above the home indicator, so `pb-8` renders as a visible empty band of background below the ❌ / 💌 / 🛒 buttons.
2. **Blue outline across the top of the sheet.** Vaul's `DrawerContent` is focusable and receives auto-focus on open. On iOS WKWebView that draws the default focus ring — the "weird blue outline" visible along the top edge of the knit-jumper screenshot. It only appears on some opens because it depends on which element ends up focused after the drawer mounts.

## Fix

**1. Tighten the listing footer padding.**
- `src/pages/ListingDetails.tsx` line 715: `pb-8` → `pb-3` on `[data-listing-footer]`.
- `src/index.css`: change the `html.is-installed [data-listing-footer]` override from `padding-bottom: 2rem` → `padding-bottom: 0.75rem` to match.

No other footer/drawer padding is touched — this is scoped to the listing sheet only, which is the one the user screenshotted.

**2. Kill the blue focus outline on Drawer/Dialog content.**
- `src/components/ui/drawer.tsx`: on `DrawerPrimitive.Content`, add `onOpenAutoFocus={(e) => e.preventDefault()}` and `className` gains `focus:outline-none focus-visible:outline-none outline-none`.
- `src/components/ui/dialog.tsx`: append `focus:outline-none focus-visible:outline-none outline-none` to the existing `DialogContent` className (auto-focus prevention is already in place there).

This removes the WKWebView focus ring on the sheet container without touching any inner focusable controls (inputs, buttons keep their own focus styles).

## Not touching

- No other drawer/sheet padding changes.
- No changes to overlay chrome, scroll restoration, or any business logic.
- No changes to Radix focus behavior beyond preventing the initial auto-focus on the drawer shell itself.
