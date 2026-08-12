# Comment box should sit just above the keyboard (Instagram/Facebook style)

## Behaviour to build

Tapping the comment box makes the composer pin itself directly above the keyboard and stay there
while typing. The comments behind it stay where they are - nothing jumps, nothing drops, no extra
space or coloured band appears, and everything returns exactly to how it looks today the moment the
keyboard closes.

## Why it fails today

- The comment composer is an ordinary block inside the listing sheet's scroll area, so it scrolls
  with the content and has nothing holding it above the keyboard.
- The listing sheet is pinned to the bottom of the screen and never shrinks for the keyboard, so
  its lower part - where the composer sits - ends up behind the keyboard.
- The shared keyboard helper hands the job to the sheet's scroll container. With a short comment
  list that container cannot scroll far enough, so the composer never clears the keyboard and the
  helper stops there instead of lifting the sheet.
- The listing page also swaps the scroll area's bottom padding on focus (`pb-32` -> `pb-4`) and
  removes the footer, dropping over 100px of height in a single frame. That is the visible drop in
  the video.

## The change

1. **Make the comment composer a real pinned composer.** Move it out of the scrolling comment list
   into a bottom-anchored bar within the listing sheet, using the same proven pattern the chat
   screens already use (`.native-keyboard-lift`, which translates by the live keyboard height). The
   comment list keeps its own scroll behind it and scrolls to the composer on focus.
2. **Bottom-anchored surfaces end above the keyboard.** Drawers and sheets get a live bottom inset
   equal to the keyboard height, so the visible sheet always finishes above the keyboard instead of
   running behind it. Purely a size change while the keyboard is up, fully removed when it closes.
3. **Scroll first, then lift.** In the shared keyboard helper, after asking a scroll container to
   scroll, measure whether the focused field actually cleared the keyboard; if the container hit its
   limit, lift the surrounding surface by the remainder. Today it gives up after the scroll attempt.
4. **No layout jump on focus.** Stop the focus-time bottom-padding swap on the listing page. The
   footer still hides while typing, but the content height stays steady.

## The other instances found

**Composers that should pin above the keyboard, like this one:**

- Listing comments composer - `src/components/ListingComments.tsx` (the one in the video, broken).
- Admin support chat composer - `src/components/admin/dashboard/MessageInput.tsx`, used by the
  admin conversation view; same plain-block problem.
- Order chat - `src/pages/OrderChat.tsx` and direct messages -
  `src/pages/ChatConversation.tsx` already pin correctly and are the pattern being reused. No
  change beyond making sure the new sheet inset does not double-shift them.

**Form fields inside bottom-anchored drawers/sheets** - these do not pin, they just need to stay
visible, and items 2 and 3 above fix them all together: make offer, write review, filter, search,
report, refund request, cancel item, change email, change password, card details, order details,
sales details, seller onboarding, new support chat, and the admin brand/listing/user sheets.

## Verification

- Preview with a simulated keyboard inset: focus the comment box with zero comments and with many
  comments; the composer sits just above the keyboard and the sheet does not jump.
- Same check for the admin chat composer, the make-offer drawer, and one full-height sheet.
- Confirm order chat and direct messages are unchanged.
- Type check. On-device confirmation needs a TestFlight pass.

## Technical scope

- `src/components/ListingComments.tsx`, `src/pages/ListingDetails.tsx` - pinned composer, remove the
  focus-time padding swap.
- `src/components/admin/dashboard/MessageInput.tsx` - same pinned pattern.
- `src/lib/keyboardAware.ts` - post-scroll residual check, then surface lift.
- `src/components/ui/drawer.tsx`, `src/components/ui/sheet.tsx`, `src/index.css` - keyboard-height
  bottom inset for bottom-anchored surfaces, skipped where a `.native-keyboard-lift` composer is
  present.

No database or edge function changes.
