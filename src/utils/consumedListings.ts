/**
 * Session-scoped set of listing IDs the user has "consumed" from the home
 * swipe deck (wishlisted, added to cart, or discarded) — whether via a swipe
 * or via the footer buttons on the listing details screen.
 *
 * Home filters the cached deck against this set synchronously, so an actioned
 * listing is already gone the moment Home re-renders. Without it, the deck
 * paints before `useFavorites` / `useDiscardedListings` finish re-fetching on
 * mount, briefly flashing already-actioned cards.
 */
let ownerId: string | null = null;
let consumed = new Set<string>();

const ensureOwner = (userId: string | null) => {
  if (ownerId !== userId) {
    ownerId = userId;
    consumed = new Set();
  }
};

export const markListingConsumed = (listingId: string, userId: string | null = ownerId) => {
  ensureOwner(userId ?? null);
  consumed.add(listingId);
};

export const unmarkListingConsumed = (listingId: string) => {
  consumed.delete(listingId);
};

export const isListingConsumed = (listingId: string) => consumed.has(listingId);

export const getConsumedListings = () => consumed;

export const clearConsumedListings = () => {
  consumed = new Set();
};

export const syncConsumedOwner = (userId: string | null) => ensureOwner(userId);
