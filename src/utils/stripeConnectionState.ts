export const getStripeConnectedStorageKey = (userId: string) => `flea_stripe_connected_${userId}`;

export const clearStripeConnectionState = (userId?: string | null) => {
  if (userId) {
    localStorage.removeItem(getStripeConnectedStorageKey(userId));
  }

  localStorage.removeItem('flea_stripe_connected');
  localStorage.removeItem('flea_stripe_pending');
};
