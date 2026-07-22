import { Capacitor } from '@capacitor/core';

type ApplePayEntitlementResult = {
  available: boolean;
  expectedMerchant: string;
  merchantIdentifiers: string[];
  hasInAppPaymentsEntitlement: boolean;
  hasExpectedMerchant: boolean;
  error?: string;
};

/**
 * No JS-readable entitlement API exists in the current native bridge. Return
 * `available: false` so Apple Pay preflight falls through to Stripe/PassKit,
 * where the signed build is checked by iOS itself.
 */
export const checkApplePayEntitlement = async (
  merchantIdentifier: string,
): Promise<ApplePayEntitlementResult> => {
  const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  return {
    available: false,
    expectedMerchant: merchantIdentifier,
    merchantIdentifiers: [],
    hasInAppPaymentsEntitlement: false,
    hasExpectedMerchant: false,
    error: isNativeIOS ? 'native-entitlement-bridge-unavailable' : 'not-native-ios',
  };
};
