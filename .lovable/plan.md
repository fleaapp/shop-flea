# Fix keyboard covering fields - properly, app wide

## What is actually wrong

There is one app-wide keyboard handler (`src/lib/keyboardAware.ts`, mounted in `App.tsx`). It works on short forms, but it fails exactly where you hit it - long forms near the bottom of a scroll area, like Add New Listing (description, price, bundle, offers rows).

Why it fails on that screen:

- Add New Listing is a `fixed inset-0 ... overflow-hidden` shell with an inner scrolling area that ends in `pb-24` (96px).
- The iOS keyboard is roughly 300-350px tall. When you focus a field near the bottom, the scroll area is already at its end, so it physically cannot scroll the field any higher - there is no space below it to scroll into.
- The handler then tries to lift the whole page instead, but a full-screen fixed shell has almost no headroom (about 40px under the notch), so the field stays behind the keys.
- Native keyboard mode is `resize: Body`, which pads `<body>`. Fixed-position shells ignore body padding entirely, so that safety net does nothing on any of these screens.

So the fix is not "scroll harder" - the screens need real space to scroll into while the keyboard is up.

## The fix

1. **Shrink full-screen shells while the keyboard is open.** Any fixed full-height surface gets its bottom edge pulled up by the live keyboard height, so the app shell simply becomes shorter, exactly like Instagram/Messages. Everything inside it (header, scroll area, footer buttons) re-lays out into the smaller area and scrolls normally. Reverted to zero the instant the keyboard closes - no padding, no colour strip, no leftover gap.

2. **Give scroll areas room to scroll into - invisibly.** While the keyboard is open, the scroll container holding the focused field gets extra scrollable room equal to the keyboard height, so even the very last field can be scrolled clear of the keys along with the next field or button under it. This room sits behind the keyboard and is never visible: no footer, no visible gap, no coloured strip. It disappears the moment the keyboard closes, and any area that briefly shows through keeps the same background as the screen or drawer it belongs to, so everything blends.

3. **Keep the lift as a fallback only** for surfaces that genuinely cannot shrink (centred dialogs), which already works today.

4. **Bottom sheets and drawers** already sit above the keyboard via `.kb-surface`; they will be re-checked against the new shell behaviour so nothing double-shifts.

## Verifying it is genuinely app wide

Rather than trusting one screen, every text-entry surface gets checked against the same rule - focused field visible, plus the next field or button below it:

- Add New Listing / Edit Listing (all fields, including description and the price fields at the bottom)
- Checkout (address, coupon code)
- Auth: login, signup, create username, create password, forgot password
- Profile edit, Settings fields, Shipping settings sheet
- Make an offer drawer, Review drawer, Refund request, Support/contact form
- Comments composer and order/admin chat (already pinned - confirm no regression)
- Search sheet, Admin dashboard forms

Anything failing that check gets fixed by the same shared mechanism, not by a one-off patch on that screen.

## Technical notes

- `src/lib/keyboardAware.ts`: add a shell-resize path - when the owning fixed surface is full-height, set a `--kb-inset` custom property on it and let CSS shrink it, instead of translating it. Add a temporary `padding-bottom` on the focused field's scroll parent equal to the keyboard height, tracked and reverted with the existing clear logic.
- `src/index.css`: add the `.kb-inset` rule (`bottom: var(--native-keyboard-height)` style shrink with the existing 180ms transition) and a scroll-padding rule, alongside the current `.kb-shifted` / `.kb-surface` rules.
- Keyboard height already comes from `@capacitor/keyboard` on native and `visualViewport` on web, so web/PWA gets the same behaviour.
- No page-level layout changes and no business logic changes.
