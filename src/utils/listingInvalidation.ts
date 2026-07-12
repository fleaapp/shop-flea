/**
 * Cross-cutting event bus for "this listing is no longer visible" signals.
 *
 * The global Realtime subscription on `public.listings` (mounted in
 * `useListingsRealtime`) fires these events whenever a listing is deleted
 * or transitions to a non-active status (removed/archived/blocked/sold).
 *
 * Every list-view hook that renders listings listens for these events and
 * drops the affected id from its local state, so deletions propagate to all
 * connected clients within ~2s without a manual refresh.
 */

export type ListingInvalidationReason =
  | 'deleted'
  | 'removed'
  | 'archived'
  | 'blocked'
  | 'sold';

export interface ListingInvalidationDetail {
  id: string;
  reason: ListingInvalidationReason;
}

const EVENT_NAME = 'flea:listing-invalidated';

export const notifyListingInvalidated = (
  id: string,
  reason: ListingInvalidationReason,
): void => {
  if (!id || typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ListingInvalidationDetail>(EVENT_NAME, {
      detail: { id, reason },
    }),
  );
};

export const subscribeListingInvalidated = (
  handler: (detail: ListingInvalidationDetail) => void,
): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;

  const listener = (event: Event) => {
    const detail = (event as CustomEvent<ListingInvalidationDetail>).detail;
    if (detail?.id) handler(detail);
  };

  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
};

/**
 * Hard-deletions should also purge the localStorage "saved listing" snapshot
 * so the ⛔️ tombstone doesn't survive forever. Sold/paused listings keep
 * their snapshot — they're a legitimate part of the buyer's history.
 */
export const shouldPurgeSnapshot = (reason: ListingInvalidationReason): boolean =>
  reason === 'deleted' || reason === 'removed' || reason === 'blocked';
