# Fix card-stack flashes and sticky toasts

## What's happening

Confirmed from the code:

- Wishlist and passed/discarded state live in per-screen hooks (`useFavorites`, `useDiscardedListings`) that start **empty** on every mount of Home and then fetch from the database. The cart, by contrast, lives in an app-level context and survives navigation.
- Since the swipe deck is now cached in memory, Home paints cards instantly on return from a listing - but for the few hundred milliseconds before wishlist/discard data comes back, those filters are empty, so items already wishlisted, carted or discarded briefly render again. That is the flash after tapping a footer button, and the suede jacket flashing after "Refresh passed listings" (returning from Settings remounts Home the same way).
- Swiping feels fine because the screen never unmounts, so the filters stay populated.

For the sticky toasts the cause is not yet confirmed: all toasts share an 1800ms duration, so a toast that stays on screen means its dismiss timer is being paused (Sonner pauses timers while the page is hidden/unfocused, which happens as a drawer closes or the app backgrounds). First step is to reproduce and confirm before hardening.

## The fix

**1. Make wishlist and passed state survive navigation**

- Give `useFavorites` and `useDiscardedListings` a shared in-memory cache (same pattern already used for the feed deck) so a remount starts with the last known IDs instead of an empty set, and a `hydrated` flag that flips true once the first fetch settles.
- Home holds back the deck (keeps showing the existing top card / skeleton) until wishlist, passed and cart state are hydrated, so no already-actioned card can paint.
- Clear the caches on sign-out and on user change so accounts never share state.

**2. Keep the deck in sync with footer actions**

- When Home remounts, drop any listing from the cached deck whose ID is now in wishlist, cart or discarded, before the first render - so the next card shows immediately instead of the actioned one reappearing.
- "Refresh passed listings" clears the passed cache too, so the refreshed deck rebuilds from current data.

**3. Toasts**

- Reproduce first: tap a footer action, close the sheet, confirm which toast lingers.
- Then harden: dismiss any outstanding toasts on route change, and resume/expire toast timers when the app returns to the foreground so a paused timer can't leave a toast on screen indefinitely.

## Technical notes

- Files: `src/hooks/useFavorites.ts`, `src/hooks/useDiscardedListings.ts`, `src/hooks/useHomeFeed.ts`, `src/pages/Index.tsx`, `src/components/ui/sonner.tsx` (plus a small route-change dismiss in `src/App.tsx`).
- Caches are module-level and user-scoped (`{ userId, ids }`), mirroring `feedCache`; guest mode continues to read `sessionStorage` as it does today.
- No database, RLS or edge-function changes.
