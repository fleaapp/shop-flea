import { Capacitor } from '@capacitor/core';
import { Stripe } from '@capacitor-community/stripe';

type ApplePayEntitlementResult = {
  available: boolean;
  expectedMerchant: string;
  merchantIdentifiers: string[];
  hasInAppPaymentsEntitlement: boolean;
  hasExpectedMerchant: boolean;
  error?: string;
};

export const checkApplePayEntitlement = async (
  merchantIdentifier: string,
): Promise<ApplePayEntitlementResult> => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    return {
      available: false,
      expectedMerchant: merchantIdentifier,
      merchantIdentifiers: [],
      hasInAppPaymentsEntitlement: false,
      hasExpectedMerchant: false,
    };
  }

  try {
    const result = await (Stripe as unknown as {
      getApplePayEntitlements(options: { merchantIdentifier: string }): Promise<Omit<ApplePayEntitlementResult, 'available'>>;
    }).getApplePayEntitlements({ merchantIdentifier });
    return { available: true, ...result };
  } catch (error: any) {
    return {
      available: false,
      expectedMerchant: merchantIdentifier,
      merchantIdentifiers: [],
      hasInAppPaymentsEntitlement: false,
      hasExpectedMerchant: false,
      error: error?.message || String(error),
    };
  }
};