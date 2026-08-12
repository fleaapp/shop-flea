# Fix the comment box being covered by the keyboard

## What happens now

Tapping the comment box inside the listing drawer does two wrong things at once:

1. The box stays behind the keyboard.
2. The whole sheet visibly drops/jumps at the moment of focus.

Both causes are confirmed in the code:

- The listing sheet (`DrawerContent`) is pinned to the bottom of the screen and never shrinks when
  the keyboard opens, so its lower part - where the composer sits - is simply behind the keyboard.
- The shared keyboard helper sees a scrollable container inside the sheet and hands the job to it.
  When the comment list is short, that container cannot scroll far enough, so the composer never
  clears the keyboard, and the helper stops there instead of lifting the sheet.
- The listing page swaps the scroll area's bottom padding from a large value to a small one the
  instant the composer is focused (`pb-32` -> `pb-4`), and removes the footer. That removes over
  100px of content height in one frame, which is the drop seen in the video.

## The fix

1. **Bottom-anchored surfaces end above the keyboard.** Drawers and sheets get a live bottom inset
   equal to the keyboard height (the value already published on `<html>`), so the visible sheet
   box always finishes above the keyboard. No colour, no padding band, nothing added - the sheet
   just occupies the space it can actually be seen in, and returns to full height the moment the
   keyboard closes.
2. **Scroll first, then lift.** In the shared keyboard helper, after asking a scroll container to
   scroll, measure whether the focused field actually cleared the keyboard. If the container hit
   its limit, lift the surrounding fixed surface by whatever is left over. Today it gives up after
   the scroll attempt.
3. **No layout jump on focus.** Stop swapping the scroll area's bottom padding when the composer is
   focused. Keep the footer hidden while typing (that behaviour is intentional), but hold the
   content height steady so nothing drops.

## Other places checked and covered by the same change

Every input that lives inside a bottom-anchored drawer or sheet has the same weakness today and is
fixed by items 1 and 2: make-offer drawer, shipping settings, settle balance, seller onboarding,
refund request, cancel item, report and support sheets, and the comment actions sheet.

Chat composers (`order chat`, `chat conversation`) already lift themselves with
`.native-keyboard-lift` and are explicitly skipped by the helper - they stay as they are, and the
new bottom inset is not applied to them so they cannot be double-shifted.

## Verification

- Preview with a simulated keyboard inset: focus the comment box with zero comments and with many
  comments; the box and the Post button stay visible and the sheet does not jump.
- Same check for the make-offer drawer and one full-height sheet.
- Confirm everything returns exactly to its current appearance once the keyboard closes.
- Type check. On-device confirmation needs a TestFlight pass.

## Technical scope

- `src/lib/keyboardAware.ts` - post-scroll residual check, then surface lift.
- `src/components/ui/drawer.tsx`, `src/components/ui/sheet.tsx`, `src/index.css` - keyboard-height
  bottom inset for bottom-anchored surfaces, excluded when a `.native-keyboard-lift` composer is
  present.
- `src/pages/ListingDetails.tsx` - remove the focus-time padding swap.

No database or edge function changes.
