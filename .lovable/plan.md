# Remaining keyboard gap: Suggestion Box

## Where things stand

The shared handler in `src/lib/keyboardAware.ts` is installed app-wide and already includes the fallback that gives a scroll area exactly the missing distance behind the keyboard when it has run out of room. Any screen whose fields live inside a real scroll container is covered by it - Edit Listing, Edit Profile, Checkout, Contact Support, the Seller Onboarding sheet, the Refund Request dialog and the Write Review drawer all qualify structurally.

One screen cannot benefit from it: Suggestion Box (`src/pages/SuggestionBox.tsx`) is a `fixed inset-0` shell with no scrollable body, so there is no container to pad and no headroom to lift into. Its textarea and Submit button can still be covered.

## The fix

1. Wrap the Suggestion Box content in the standard scrollable body used by the other pages (`flex-1 min-h-0 overflow-y-auto overscroll-contain`) between the header and the bottom nav. With the keyboard closed nothing changes visually.
2. With a scroll parent present, the existing fallback handles the rest: the textarea and the Submit button below it clear the keys, and the temporary room disappears on blur.
3. No change to the shared handler, no padding strip, no footer, no colour.

## Verification

Check at a phone viewport with the keyboard height mocked:

- Suggestion Box - textarea plus Submit visible while typing, no leftover space after blur
- Spot-check Edit Listing, Edit Profile, Checkout and Contact Support to confirm the existing fallback behaves and nothing regressed
