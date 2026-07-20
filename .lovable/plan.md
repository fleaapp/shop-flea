## Problem

On Wishlist, tapping the X and then tapping Cancel/Remove in the confirm dialog causes the page to jerk up/down. This is the Radix AlertDialog scroll-lock behaviour: when the dialog opens it locks `body` scroll (via `RemoveScroll`) and on close returns focus to the trigger button, which iOS then scrolls into view. Because our custom `AlertDialogOverlay` also stretches into the safe-area (`top-[calc(-1*env(safe-area-inset-top,0px))]`) and `useOverlayChrome` toggles the status bar overlay on open/close, the layout height changes slightly on both transitions — amplifying the shake.

The same `AlertDialog` (and Radix `Dialog`) is used across the app (cart swipe-to-remove, settings, listing actions, admin, checkout confirmations, etc.), so a fix at the primitive layer stops the shake everywhere at once.

## Fix

Update `src/components/ui/alert-dialog.tsx` (and mirror in `src/components/ui/dialog.tsx`) so that:

1. `AlertDialogContent` sets `onOpenAutoFocus` and `onCloseAutoFocus` to `preventDefault()`. This stops Radix from auto-focusing the trigger on close, which is the main cause of iOS scrolling the page to bring the X button into view (the "shake" on Cancel/Remove).
2. Preserve the current scroll position across open/close: on open, capture `window.scrollY`; on close, restore it in a `requestAnimationFrame`. This defeats the residual jump that `RemoveScroll` causes on iOS Safari / Capacitor WebView when it toggles `body { overflow: hidden }`.
3. Debounce `useOverlayChrome`'s status-bar toggle so a dialog that opens and closes within one frame doesn't re-trigger the native status-bar overlay change (which resizes the WebView by the status bar height and reads as a "shake").

No changes to `WishlistCard` / `WishlistGridCard` themselves — the confirm dialog logic there is fine.

## Verification

- Wishlist grid + list: tap X, then Cancel, then X → Remove. No vertical jump on any transition.
- Cart swipe-to-remove confirm dialog: same check.
- Settings destructive confirms (delete account, sign-out prompts) and checkout confirmations: verify no regression in focus behaviour (keyboard users can still tab to trigger after close).
- Repeat on iPhone 17 Pro Max (Dynamic Island) since that's where safe-area shifts are largest.

## Files touched

- `src/components/ui/alert-dialog.tsx` — add `onOpenAutoFocus` / `onCloseAutoFocus` preventDefault + scroll-position preservation on `AlertDialogContent`.
- `src/components/ui/dialog.tsx` — mirror the same two changes so non-alert dialogs (sheets built on Dialog) don't shake either.
- `src/lib/appChrome.ts` or `src/lib/useOverlayChrome.ts` — small debounce so rapid open/close doesn't flap the native status bar overlay.
