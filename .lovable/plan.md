## Problem

The native focus-scroll handler in `src/main.tsx` only nudges the focused input when its scroll parent is *already* taller than its viewport (`scrollHeight > clientHeight`). On pages like Create Listing / Edit Listing / Sale Details / Shipping tracking, the inner `overflow-y-auto` container's content often fits within the visible area, so:

- `findScrollParent` skips it (fails the `scrollHeight > clientHeight` check) and falls back to `window`.
- The shell is `fixed inset-0`, so `window.scrollBy` does nothing.
- Even when it is picked, there's no extra room below the last field to scroll it above the keyboard.

Comments and message chats work because their composers use `.native-keyboard-lift` (translated up via CSS var) — not the scroll handler.

## Fix (frontend only, `src/main.tsx`)

Update the native keyboard handling so the scroll-into-view path works on every screen without touching layouts, chrome, or the keyboard background:

1. **Relax scroll-parent detection.** In `findScrollParent`, accept any ancestor whose computed `overflow-y` is `auto`/`scroll` — drop the `scrollHeight > clientHeight` gate. We'll add the room ourselves in step 2.

2. **Add temporary bottom padding equal to the keyboard height** to the chosen scroll parent while the keyboard is up, so a field near the bottom can actually be scrolled above it. Store the original `paddingBottom` on the element, set `paddingBottom: originalPx + keyboardPx + MARGIN` on `keyboardWillShow` / re-focus, and restore it on `keyboardWillHide` / `focusout`.

3. **Recompute on keyboard height change.** The existing `keyboardWillShow` / `keyboardDidShow` listeners already re-run visibility — extend them to also update the padding on the current scroll parent.

4. **Skip when composer opts out.** Keep the existing `.native-keyboard-lift` short-circuit so message/comment composers keep their current CSS-translate behavior untouched.

5. **No changes elsewhere.** Do NOT touch `capacitor.config.ts` (keyboard stays `Body` + transparent, no black background), `src/pages/Auth.tsx` (logo/form stay put), status bar, or footer chrome.

## Verification

- Native TestFlight: tap the Description and Price fields on Create Listing, tracking-number field in Sale Details, address fields in Checkout — each should scroll above the keyboard.
- Comments and chat composers should continue to lift via CSS translate, unchanged.
- Keyboard background should remain transparent (unchanged config).
- Auth screen layout should be identical to now.

## Technical notes

- All logic lives in the existing `if (Capacitor.isNativePlatform())` block in `src/main.tsx`.
- Padding restore must be idempotent (guard against double-apply on repeated `keyboardWillShow` events).
- Use `dataset.fleaKbPadRestore` to stash the original inline `paddingBottom` so we can restore it exactly.
