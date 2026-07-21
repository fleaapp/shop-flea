import { Capacitor } from '@capacitor/core';
import { Stripe } from '@capacitor-community/stripe';
import { logError } from '@/lib/errorLogger';
import { checkApplePayEntitlement } from '@/lib/nativeEntitlements';

export type ApplePayDiagnosis = {
  ok: boolean;
  code:
    | 'not-ios'
    | 'available'
    | 'stripe-check-failed'
    | 'entitlement-missing'
    | 'merchant-missing'
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

export const logApplePayDiagnostic = async (
  stage: string,
  diagnosis: ApplePayDiagnosis,
  context: Record<string, unknown> = {},
) => {
  const raw = typeof diagnosis.raw === 'string' ? diagnosis.raw : JSON.stringify(diagnosis.raw ?? null);
  await logError({
    title: `Apple Pay ${stage}`,
    message: `${diagnosis.code}: ${raw || diagnosis.userMessage}`,
    severity: diagnosis.code === 'canceled' ? 'warning' : 'error',
    source: 'client',
    context: {
      platform: Capacitor.getPlatform(),
      diagnosisCode: diagnosis.code,
      ok: diagnosis.ok,
      ...context,
    },
  });
};

/**
 * Pre-flight Apple Pay before PassKit opens its system sheet. The native
 * entitlement check reads the entitlements from the signed app binary, which
 * catches the exact case where the source plist is correct but the archived
 * provisioning profile did not include the Apple Pay merchant entitlement.
 */
export const runApplePayPreflight = async (merchantIdentifier: string): Promise<ApplePayDiagnosis> => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    return { ok: false, code: 'not-ios', userMessage: 'Apple Pay is only available on iOS.' };
  }

  const entitlement = await checkApplePayEntitlement(merchantIdentifier);
  if (entitlement.available && !entitlement.hasInAppPaymentsEntitlement) {
    return {
      ok: false,
      code: 'entitlement-missing',
      userMessage:
        'Apple Pay is not enabled in this app build. Please use Add new card while we update the signed Apple Pay entitlement.',
      raw: entitlement,
    };
  }
  if (entitlement.available && !entitlement.hasExpectedMerchant) {
    return {
      ok: false,
      code: 'merchant-missing',
      userMessage:
        'Apple Pay is enabled, but this build is signed with the wrong merchant. Please use Add new card while we update it.',
      raw: entitlement,
    };
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
