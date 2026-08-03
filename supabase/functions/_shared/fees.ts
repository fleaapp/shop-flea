// Single source of truth for Flea's fee model on the server.
//
//  Buyer pays:   items + shipping + Secure Checkout Fee (4% + $0.70)
//  Seller earns: items + shipping - Transaction Fee (2% + $0.50)
//
// Keep these values in sync with src/utils/feeCalculator.ts.

export const SECURE_CHECKOUT_RATE = 0.04;
export const SECURE_CHECKOUT_FIXED = 0.70;

export const TRANSACTION_FEE_RATE = 0.02;
export const TRANSACTION_FEE_FIXED = 0.50;

export const INSTANT_PAYOUT_RATE = 0.015;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateSecureCheckoutFee(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return round2(subtotal * SECURE_CHECKOUT_RATE + SECURE_CHECKOUT_FIXED);
}

export function calculateTransactionFee(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return round2(subtotal * TRANSACTION_FEE_RATE + TRANSACTION_FEE_FIXED);
}
