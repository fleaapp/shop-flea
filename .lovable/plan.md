## Goal
Make the product listing popup top area match the seller dashboard popup: the original screen remains visible behind a dim overlay, and the popup itself is not covered by a solid black status-bar strip.

## What I found
- Product listing details use the shared `Drawer` component.
- The seller dashboard uses the shared `Sheet` component plus a specific overlay class.
- The current shared overlay/status-bar logic paints the native safe-area/status area solid black for overlays, which is why the top of the listing popup looks wrong.
- Other `Drawer`-based bottom popups are likely to show the same issue.

## Plan
1. **Fix the shared overlay chrome logic**
   - Update the native overlay/status-bar styling so overlays dim the visible app behind them instead of adding an opaque black bar over the top safe area.
   - Keep the seller dashboard look as the reference: dimmed background, visible underlying app, no solid black top covering the popup.

2. **Align product listing popup with seller dashboard behavior**
   - Update the listing detail drawer to use the same overlay appearance/logic as the seller dashboard sheet.
   - Adjust the listing drawer top spacing/height only as needed so the rounded top sits cleanly below the safe area and the dimmed background remains visible above it.

3. **Apply the same fix to similar top-of-screen popups**
   - Audit shared `Drawer`, `Sheet`, `Dialog`, and `AlertDialog` overlays.
   - Fix the shared component(s), not only `ListingDetails`, so other bottom popups such as order details, sales details, checkout drawer, filters/search, shipping/settings drawers, and review drawers don’t keep the same black-top issue.

4. **Verify visually on mobile viewport**
   - Open listing details and confirm the top matches the seller dashboard reference.
   - Check representative drawers/sheets to make sure the dim overlay reaches the top without a hard black strip or covering the popup.

## Files expected to change
- `src/lib/appChrome.ts`
- `src/index.css`
- `src/components/ui/drawer.tsx`
- Possibly `src/components/ui/sheet.tsx`, `src/components/ui/dialog.tsx`, and `src/components/ui/alert-dialog.tsx` if the shared overlay behavior needs normalising across all popup types.