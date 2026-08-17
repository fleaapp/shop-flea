# Keyboard fix for the remaining screens

The rule: tap any text box and you see the box you are typing in, plus whatever field or button sits directly below it. Nothing else moves, no extra footer, no padding strip, no colour.

## Screens that still fail

Same structure as Add New Listing - a full-height fixed shell with an inner scroll area whose content ends at or near the last field, so there is nothing left to scroll into:

- Edit Listing - description, price and bundle rows at the bottom
- Edit Profile - bio and social fields at the end of the scroll area
- Checkout - address block and coupon field low in the scroll area
- Contact Support - message field at the end of the scroll area
- Suggestion Box - no scroll area at all: fixed shell, tall textarea, submit button underneath
- Seller Onboarding sheet - address and postcode steps, last field sits just above the footer
- Refund Request dialog and Write Review drawer - textarea near the bottom of a height-capped surface

Already correct and untouched: comments composer, order chat, admin chat, offer drawer.

## The fix

1. Reuse the same fallback already used for Add New Listing: only when the scroll area has run out of room, give it exactly the missing distance as temporary scroll room behind the keyboard, so the focused field and the control under it clear the keys. Removed the instant the keyboard closes.
2. Suggestion Box has no scroll area, so wrap its content in the standard `flex-1 min-h-0 overflow-y-auto` body used by the other pages - no visual change with the keyboard closed.
3. Where the handler already succeeds, nothing changes.

## Technical notes

- No change to `src/lib/keyboardAware.ts` logic beyond what is already in place; the fallback applies automatically once each surface exposes a real scroll parent.
- `src/pages/SuggestionBox.tsx`: content moves into a scrollable body between header and BottomNav.
- Verify each screen at 440x681 with the keyboard height mocked, confirming the focused field and next control are visible and no padding remains after blur.
