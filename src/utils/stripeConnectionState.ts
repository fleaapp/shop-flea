export const STRIPE_CONNECTED_STORAGE_PREFIX = 'flea_stripe_connected_';

export const getStripeConnectedStorageKey = (userId: string) => `${STRIPE_CONNECTED_STORAGE_PREFIX}${userId}`;

export const clearStripeConnectionState = (userId?: string | null) => {
  if (typeof window === 'undefined') return;

  if (userId) {
    localStorage.removeItem(getStripeConnectedStorageKey(userId));
  }

  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(STRIPE_CONNECTED_STORAGE_PREFIX)) {
      localStorage.removeItem(key);
    }
  }

  localStorage.removeItem('flea_stripe_connected');
  localStorage.removeItem('flea_stripe_pending');
};
