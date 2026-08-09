# Fix persistent listing-action toasts

## Confirmed cause

- Listing footer confirmations use `toast.success(...)`, and the shared Sonner configuration maps every success toast to `✅`, so wishlist, cart and discard all show the same green tick.
- The footer handlers create a toast and immediately navigate back to Home. Sonner remains mounted globally, allows multiple visible toasts by default, and pauses timers while the page is hidden, which explains the stacked confirmations and toasts that can remain after navigation or app state changes.
- The current cleanup only runs on browser visibility/page-hide events. It does not prevent multiple footer confirmations from accumulating, and its dismissal animation can still leave old toast layers visible briefly.

## Changes

1. Update the shared Sonner configuration to show only one toast at a time and keep its short dismissal timer running when the app/page visibility changes.
2. Give listing-detail footer confirmations one stable toast ID so a new footer action replaces any previous footer confirmation instead of adding another layer.
3. Use action-specific icons rather than the generic success type:
   - `💌` for wishlist confirmations.
   - `🛒` for cart confirmations.
   - `❌` for discard/removal confirmations.
4. Keep existing error, notification and non-footer toast behaviour unchanged.

## Verification

- Trigger Wishlist, Cart and Discard from listing details and confirm each returns naturally to Home with the correct emoji.
- Confirm only one confirmation is visible, it disappears after the configured timeout, and no toast remains after backgrounding and foregrounding the app.
- Repeat actions across several listings to confirm confirmations replace rather than stack.

## Technical scope

- Frontend only: `src/components/ui/sonner.tsx` and the listing footer toast calls in `src/pages/ListingDetails.tsx`.
- No database, auth, payment or listing-state changes.