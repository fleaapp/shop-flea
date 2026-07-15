import { loadStripe, type Stripe as StripeJs } from '@stripe/stripe-js';
import { invokeCloudFunction } from '@/utils/cloudFunctions';

let cachedPromise: Promise<StripeJs | null> | null = null;
let cachedKey: string | null = null;

async function fetchPublishableKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  const { data } = await invokeCloudFunction('stripe-config', { method: 'GET' });
  const key = data?.publishableKey || '';
  if (!key) throw new Error('Missing Stripe publishable key');
  cachedKey = key;
  return key;
}

export function getStripe(): Promise<StripeJs | null> {
  if (!cachedPromise) {
    cachedPromise = fetchPublishableKey().then((key) => loadStripe(key));
  }
  return cachedPromise;
}
