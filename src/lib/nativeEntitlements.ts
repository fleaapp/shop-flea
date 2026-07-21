import { Capacitor, registerPlugin } from '@capacitor/core';

type ApplePayEntitlementResult = {
  available: boolean;
  expectedMerchant: string;
  merchantIdentifiers: string[];
  hasInAppPaymentsEntitlement: boolean;
  hasExpectedMerchant: boolean;
  error?: string;
};

type FleaEntitlementsPlugin = {
  getApplePayEntitlements(options: { merchantIdentifier: string }): Promise<Omit<ApplePayEntitlementResult, 'available'>>;
};

const FleaEntitlements = registerPlugin<FleaEntitlementsPlugin>('FleaEntitlements');

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
    const result = await FleaEntitlements.getApplePayEntitlements({ merchantIdentifier });
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