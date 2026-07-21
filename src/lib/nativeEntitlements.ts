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
 * Runtime entitlement inspection would require a native plugin method to call
 * SecTaskCopyValueForEntitlement. We ship without that plugin patch, so this
 * always returns `available: false` and the Apple Pay preflight falls through
 * to Stripe's own `isApplePayAvailable()` check.
 */
export const checkApplePayEntitlement = async (
  merchantIdentifier: string,
): Promise<ApplePayEntitlementResult> => {
  void Capacitor.getPlatform();
  return {
    available: false,
    expectedMerchant: merchantIdentifier,
    merchantIdentifiers: [],
    hasInAppPaymentsEntitlement: false,
    hasExpectedMerchant: false,
  };
};
