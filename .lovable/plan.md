# Fix the card-stack ghost card (pinstripe pants)

## What's actually happening

Confirmed in the code, not guessed:

- `src/hooks/useFavorites.ts` starts with an empty set on every mount (only guest wishlist seeds it) and fetches wishlist IDs from the database in an effect.
- `src/hooks/useDiscardedListings.ts` does exactly the same for passed listings.
- Both hooks live inside `src/pages/Index.tsx`, which unmounts every time a listing is opened, so both sets reset to empty and refill asynchronously each time you come back.
- The home deck itself is cached (`feedCache` in `useHomeFeed.ts`) and paints instantly, and the deck filter in `Index.tsx` (line ~286) removes cards using `favoriteIds` / `discardedIds` / cart.

So on return from a listing, the deck paints with those sets still empty. Any listing already wishlisted or passed - for example the pinstripe pants, actioned earlier or from another screen - renders as the top card for a few hundred milliseconds until the fetch lands, then disappears. Swiping never shows this because Home stays mounted.

The `consumedListings` set added last time only covers items actioned in this session via a swipe or the listing-details footer, which is why one older item keeps ghosting.

## The fix

Make the wishlist and passed sets survive remounts, so the first render already knows what to hide.

1. Hold the fetched IDs in a module-level, user-scoped cache in each hook (the same pattern `useHomeFeed` already uses for the deck), and seed initial state from it. A remount reuses the cache instantly; the background fetch still runs and reconciles.
2. Persist that cache to `localStorage` per user, so it also survives a cold app start / full reload. Writes on every add/remove keep it in step.
3. Clear both caches on sign-out (alongside the existing `clearConsumedListings`) and on "Refresh passed listings" in Settings, so refreshed items reappear correctly.
4. Keep `consumedListings` as-is for same-session actions.

Result: returning from a listing behaves exactly like a swipe - the next card is already on top, with no flash, regardless of when or where the item was actioned.

## Technical notes

- `src/hooks/useFavorites.ts`: module-level `Map`/`Set` cache keyed by user id + `localStorage` key `flea_fav_ids_<uid>`; lazy `useState` initialiser reads it; update on fetch, add, remove.
- `src/hooks/useDiscardedListings.ts`: same treatment with `flea_discarded_ids_<uid>`.
- `src/context/AuthContext.tsx` sign-out: clear both caches.
- `src/pages/Settings.tsx` `handleRefreshDiscarded`: clear the discarded cache.
- No changes to the deck filter, swipe handlers, database, RLS or edge functions.
