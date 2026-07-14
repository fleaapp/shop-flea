import { loadConnectAndInitialize } from '@stripe/connect-js';
import type { StripeConnectInstance } from '@stripe/connect-js';
import { invokeCloudFunction } from '@/utils/cloudFunctions';

/** Flea appearance for embedded Stripe Connect surfaces. */
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

let pkCache: string | null = null;

async function fetchSession(): Promise<{ clientSecret: string; publishableKey: string }> {
  const { data, error } = await invokeCloudFunction('stripe-connect-account-session', {});
  if (error) throw new Error(error.message || 'Failed to create account session');
  if (!data?.clientSecret) throw new Error('No clientSecret returned');
  if (!data?.publishableKey) throw new Error('No publishableKey returned');
  return { clientSecret: data.clientSecret, publishableKey: data.publishableKey };
}

/**
 * Creates a Connect instance for the signed-in seller.
 * Bootstraps the publishable key from the first session response.
 */
export async function createFleaConnectInstance(): Promise<StripeConnectInstance> {
  const first = await fetchSession();
  pkCache = first.publishableKey;

  const fetchClientSecret = async (): Promise<string> => {
    // Use the first secret on init, then fetch fresh ones on refresh.
    if (first.clientSecret) {
      const cs = first.clientSecret;
      // consume once
      (first as { clientSecret?: string }).clientSecret = undefined;
      return cs;
    }
    const next = await fetchSession();
    return next.clientSecret;
  };

  return loadConnectAndInitialize({
    publishableKey: pkCache,
    fetchClientSecret,
    appearance,
    fonts: [
      {
        cssSrc:
          'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
      },
    ],
  });
}
