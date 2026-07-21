import { Capacitor } from '@capacitor/core';
import { Stripe } from '@capacitor-community/stripe';

export type ApplePayDiagnosis = {
  ok: boolean;
  code:
    | 'not-ios'
    | 'available'
    | 'stripe-check-failed'
    | 'entitlement-missing'
    | 'no-cards'
    | 'canceled'
    | 'unknown';
  userMessage: string;
  raw?: unknown;
};

/**
 * Categorises an Apple Pay error. The iOS system alert
 * "Apple Pay Is Not Available in 'Flea' — Check the settings for this app…"
 * is emitted by PassKit when the signed build is missing the
 * `com.apple.developer.in-app-payments` entitlement or the merchant
 * identifier is not included in the entitlement / provisioning profile.
 */
export const categoriseApplePayError = (err: unknown): ApplePayDiagnosis => {
  const raw =
    typeof err === 'object' && err && 'message' in (err as Record<string, unknown>)
      ? String((err as { message: unknown }).message ?? '')
      : String(err ?? '');
  const msg = raw.toLowerCase();

  if (msg.includes('cancel')) {
    return { ok: false, code: 'canceled', userMessage: 'Payment was cancelled.', raw };
  }
  if (
    msg.includes('not available') ||
    msg.includes('not designed') ||
    msg.includes('entitlement') ||
    msg.includes('merchant')
  ) {
    return {
      ok: false,
      code: 'entitlement-missing',
      userMessage:
        'Apple Pay isn\'t enabled on this build. Please use Add new card, or contact support so we can enable the Apple Pay entitlement.',
      raw,
    };
  }
  if (msg.includes('card') || msg.includes('wallet')) {
    return {
      ok: false,
      code: 'no-cards',
      userMessage: 'Add a card to Apple Wallet, then try Apple Pay again.',
      raw,
    };
  }
  return {
    ok: false,
    code: 'unknown',
    userMessage: raw || 'Apple Pay could not start. Please try Add new card.',
    raw,
  };
};

/** Pre-flight only — cannot detect a missing entitlement (PassKit does). */
export const runApplePayPreflight = async (): Promise<ApplePayDiagnosis> => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    return { ok: false, code: 'not-ios', userMessage: 'Apple Pay is only available on iOS.' };
  }
  try {
    await Stripe.isApplePayAvailable();
    return { ok: true, code: 'available', userMessage: 'Apple Pay is available.' };
  } catch (err) {
    const diag = categoriseApplePayError(err);
    // If Stripe's pre-check fails, treat as stripe-check-failed unless we
    // already matched a more specific category.
    if (diag.code === 'unknown') {
      return {
        ok: false,
        code: 'stripe-check-failed',
        userMessage:
          'Apple Pay isn\'t set up on this device or in this build. Please use Add new card.',
        raw: diag.raw,
      };
    }
    return diag;
  }
};
