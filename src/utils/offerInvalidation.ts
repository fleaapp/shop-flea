export interface OfferInvalidationDetail {
  listingId?: string;
}

const EVENT_NAME = 'flea:offer-changed';

export const notifyOfferChanged = (listingId?: string): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<OfferInvalidationDetail>(EVENT_NAME, {
      detail: { listingId },
    }),
  );
};

export const subscribeOfferChanged = (
  handler: (detail: OfferInvalidationDetail) => void,
): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (event: Event) => {
    handler((event as CustomEvent<OfferInvalidationDetail>).detail ?? {});
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
};