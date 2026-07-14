import { loadConnectAndInitialize } from '@stripe/connect-js';
import { invokeCloudFunction } from '@/utils/cloudFunctions';

// Publishable key comes from env (public, safe in codebase).
// Falls back to reading from `import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY`.
const PUBLISHABLE_KEY =
  (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY ||
  (import.meta as any).env?.VITE_STRIPE_PUBLIC_KEY ||
  '';

/**
 * Flea appearance for embedded Stripe Connect surfaces.
 * Mirrors the app's lime/charcoal palette + Inter typography.
 */
const appearance = {
  variables: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    colorPrimary: '#C4E64B',
    colorBackground: '#ffffff',
    colorText: '#1A1A1A',
    colorSecondaryText: '#6b6b6b',
    colorBorder: '#e6e6e6',
    colorDanger: '#dc2626',
    buttonPrimaryColorBackground: '#C4E64B',
    buttonPrimaryColorText: '#1A1A1A',
    buttonPrimaryColorBorder: '#C4E64B',
    buttonSecondaryColorBackground: '#F4F2EB',
    buttonSecondaryColorText: '#1A1A1A',
    buttonSecondaryColorBorder: '#F4F2EB',
    formHighlightColorBorder: '#C4E64B',
    formAccentColor: '#C4E64B',
    borderRadius: '12px',
    spacingUnit: '4px',
  },
} as const;

/**
 * Fetch a fresh AccountSession client secret from the edge function.
 * Called by the Connect SDK on init AND for silent refresh.
 */
async function fetchClientSecret(): Promise<string> {
  const { data, error } = await invokeCloudFunction('stripe-connect-account-session', {});
  if (error) throw new Error(error.message || 'Failed to create account session');
  if (!data?.clientSecret) throw new Error('No clientSecret returned');
  return data.clientSecret as string;
}

/**
 * Returns a lazily-initialised StripeConnectInstance for the signed-in seller.
 * The Provider component in `FleaConnectProvider.tsx` will hold onto it.
 */
export function createFleaConnectInstance() {
  if (!PUBLISHABLE_KEY) {
    throw new Error(
      'Missing Stripe publishable key. Set VITE_STRIPE_PUBLISHABLE_KEY.'
    );
  }
  return loadConnectAndInitialize({
    publishableKey: PUBLISHABLE_KEY,
    fetchClientSecret,
    appearance,
    fonts: [
      {
        cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
      },
    ],
  });
}
