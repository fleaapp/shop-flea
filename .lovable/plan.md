# Fix card-stack flashes and sticky toasts (simple version)

## What's happening

Home paints the cached deck instantly on return from a listing, but the wishlist/passed filters (`useFavorites`, `useDiscardedListings`) start empty on every remount and only fill in after a database fetch. In that gap, already-actioned items render again - that's the flash after a footer action and the suede jacket flashing after "Refresh passed listings". Swiping looks right because Home never unmounts.

## The simple fix

Rather than reworking state hydration, do exactly what a swipe does: mark the listing as consumed and move on.

- One shared, in-memory "consumed" set of listing IDs, written by both swipe handlers and the listing-details footer actions (Wishlist, Cart, Discard).
- Home filters the deck against that set synchronously on render, so a listing actioned from the details screen is already gone the moment Home reappears and the next card is on top - no waiting for any fetch, no flash.
- The set is user-scoped and cleared on sign-out and on "Refresh passed listings", so refreshed items come back properly.

That's a small change in three places and it removes the flash for both videos, because nothing depends on fetch timing any more.

## Toasts

Cause not yet confirmed - every toast already has an 1800ms duration, so a lingering toast means its timer was paused (Sonner pauses while the page is hidden/unfocused, which happens as a drawer closes or the app backgrounds). Reproduce first, then dismiss outstanding toasts on route change and expire paused timers when the app returns to the foreground.

## Technical notes

- New tiny module `src/utils/consumedListings.ts` (module-level `Set` + user scope + clear).
- Writers: `src/pages/Index.tsx` swipe handlers, `src/pages/ListingDetails.tsx` wishlist/cart/discard handlers.
- Reader: `src/pages/Index.tsx` deck filter (alongside the existing favourite/cart/discard checks).
- Cleared from sign-out and from `handleRefreshDiscarded` in `src/pages/Settings.tsx`.
- Toast handling: `src/components/ui/sonner.tsx` plus a route-change dismiss in `src/App.tsx`.
- No database, RLS or edge-function changes.
