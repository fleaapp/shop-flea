/**
 * Single source of truth for Flea's fee model.
 *
 * Money flow per sale:
 *  Buyer pays:    items + shipping + Secure Checkout Fee (4% + $0.70)
 *  Seller earns:  items + shipping − Transaction Fee (2% + $0.50)
 *  Flea revenue:  Secure Checkout Fee + Transaction Fee − payment processing cost
 *
 * Sellers pay no listing fees — the Transaction Fee only applies per completed sale.
 */

// Buyer-paid Secure Checkout Fee
export const SECURE_CHECKOUT_RATE = 0.04;
export const SECURE_CHECKOUT_FIXED = 0.70;

// Seller-paid Transaction Fee (deducted from payout)
export const TRANSACTION_FEE_RATE = 0.02;
export const TRANSACTION_FEE_FIXED = 0.50;

// Legacy alias — total seller-side platform fee rate for reporting only.
export const PLATFORM_FEE_RATE = TRANSACTION_FEE_RATE;

export type PaymentMethod = 'stripe';

export interface FeeBreakdown {
  itemsTotal: number;         // sum of item prices
  shipping: number;           // total shipping
  subtotal: number;           // items + shipping
  secureCheckoutFee: number;  // buyer-paid Secure Checkout Fee
  processingFee: number;      // alias of secureCheckoutFee for backwards compat
  buyerTotal: number;         // what buyer actually pays
  transactionFee: number;     // seller-paid Transaction Fee
  platformFee: number;        // = transactionFee (legacy alias)
  sellerReceives: number;     // payout to seller (subtotal − transactionFee)
  paymentMethod: PaymentMethod;
  rateLabel: string;          // buyer fee label e.g. "4% + $0.70"
  transactionFeeLabel: string;// seller fee label e.g. "2% + $0.50"
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calculateTransactionFee(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return r2(subtotal * TRANSACTION_FEE_RATE + TRANSACTION_FEE_FIXED);
}

export function calculateFees(
  itemsTotal: number,
  shipping: number,
  _paymentMethod: PaymentMethod = 'stripe'
): FeeBreakdown {
  const subtotal = itemsTotal + shipping;

  const secureCheckoutFee = r2(subtotal * SECURE_CHECKOUT_RATE + SECURE_CHECKOUT_FIXED);
  const transactionFee = calculateTransactionFee(subtotal);
  const rateLabel = `${(SECURE_CHECKOUT_RATE * 100).toFixed(0)}% + $${SECURE_CHECKOUT_FIXED.toFixed(2)}`;
  const transactionFeeLabel = `${(TRANSACTION_FEE_RATE * 100).toFixed(0)}% + $${TRANSACTION_FEE_FIXED.toFixed(2)}`;

  const buyerTotal = r2(subtotal + secureCheckoutFee);
  const sellerReceives = r2(subtotal - transactionFee);

  return {
    itemsTotal,
    shipping,
    subtotal,
    secureCheckoutFee,
    processingFee: secureCheckoutFee,
    buyerTotal,
    transactionFee,
    platformFee: transactionFee,
    sellerReceives,
    paymentMethod: 'stripe',
    rateLabel,
    transactionFeeLabel,
  };
}

/** Quick helper for listing previews — seller take-home after the transaction fee. */
export function sellerEarningsPreview(price: number, shipping = 0): number {
  const subtotal = price + shipping;
  return r2(subtotal - calculateTransactionFee(subtotal));
}
