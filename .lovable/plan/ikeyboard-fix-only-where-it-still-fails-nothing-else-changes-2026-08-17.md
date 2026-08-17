# IKeyboard fix: only where it still fails, nothing else changes

## The rule we are aiming for

Tap any text box anywhere in the app and you see: the box you are typing in, plus whatever field or button sits directly below it. Nothing else moves, no extra footer, no padding, no coloured strip - the screen just slides up in place.

## Why most screens already work, and Add New Listing does not

The shared handler (`src/lib/keyboardAware.ts`, installed once in `App.tsx`) already does the right thing on short forms and on drawers: it scrolls the focused field into view, and if the surface can be lifted, it lifts it. Those screens stay exactly as they are.

Add New Listing fails for one specific reason: the field being typed into is near the bottom of a long scroll area whose content ends only 96px below it. The handler asks the scroll area to scroll further, and it physically cannot - it is already at the end. There is no room left below the field, so the field stays behind the keys. Lifting the whole page is not available either, because that screen is a full-height fixed shell with only the notch gap above it.

So this is not a "redo the app-wide system" problem. It is a "the last screenful of a long form has nowhere to scroll to" problem.

## The fix

1. **Only when the scroll area runs out of room**, and only for the amount it is short by, give it that much extra scroll distance so the focused field and the element under it clear the keyboard. This space is behind the keyboard, never visible, and is removed the instant the keyboard closes. No footer, no gap, no colour.
2. **Where the handler already succeeds today, nothing changes.** The new step is a fallback that only runs after the existing scroll attempt still leaves the field covered.
3. **Include the next element below** in the target the handler tries to reveal, so you can see the following field or button, not just the field you are in. Today it aims at the field alone.
4. **Drawers and pinned composers** (comments, order chat, admin chat, offer, review) keep their current pinned behaviour untouched - they are explicitly skipped by the fallback.

## Check, do not assume

Each surface gets checked against the one rule above, and only ones that fail get touched:

- Add New Listing and Edit Listing (description, price fields, bundle/offers rows at the bottom) - known failing
- Checkout address and coupon code
- Auth: login, signup, username, password, forgot password
- Profile edit, Settings fields, Shipping settings sheet
- Offer, review, refund request, support form
- Comments and chat composers - confirm no regression

## Technical notes

- `src/lib/keyboardAware.ts`: after `ensureVisible` scrolls, measure the residual overlap. If the scroll parent is at `scrollTop === scrollHeight - clientHeight` and residual > 0, set a temporary `padding-bottom` on that scroll parent equal to the residual (not the full keyboard height), scroll again, and record it for teardown in the existing keyboard-hide/blur cleanup. Extend the visibility target from the focused element's rect to include its next focusable sibling/button when one exists within a small distance.
- No change to `.kb-shifted`, `.kb-surface`, or `resize: Body`; no page-level layout edits; no business logic changes.