## Problem

The gap the user is pointing at is not under the buttons — it's under the whole drawer sheet. The listing sheet is set to `h-[95svh] max-h-[95svh]` (line 486 of `src/pages/ListingDetails.tsx`), so 5svh of background shows below the sheet's rounded bottom edge. Shrinking the footer's own `pb-*` (what I did last turn) can't remove that band because the empty space is outside the sheet.

For most of the project, `overlaysWebView` was `true`, so the webview extended under the home indicator and 95svh visually reached the bottom. It's now `false`, so the webview stops above the home indicator and the missing 5svh becomes a visible gap.

## Fix

Make the listing sheet fill the available webview height so the footer sits flush at the bottom, exactly like before.

- `src/pages/ListingDetails.tsx` line 486: change `h-[95svh] max-h-[95svh]` → `h-[100svh] max-h-[100svh]` on `DrawerContent`.
- `src/pages/ListingDetails.tsx` line 715: restore the footer's own bottom padding to the original `pb-8` on `[data-listing-footer]`.
- `src/index.css` line 361-363: restore `html.is-installed [data-listing-footer]` to `padding-bottom: 2rem` (pb-8) so PWA/native matches.

## Not touching

- No other drawer heights, no other footer padding, no scroll-restore or focus-outline logic (those stay as-is from the previous fix).
