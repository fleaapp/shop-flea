/**
 * Single source of truth for Flea's fee model.
 *
 * Money flow per sale:
 *  Buyer pays:    items + shipping + Secure Checkout Fee (4% + $0.70)
 *  Stripe takes:  ~1.75% + $0.30 of total charge — deducted from SELLER (on_behalf_of=seller)
 *  Flea takes:    application_fee_amount = full Secure Checkout Fee
 *                 (Flea's net revenue = Secure Checkout Fee − Stripe's actual cost)
 *  Seller gets:   items + shipping in full — no selling fees
 */

// Buyer-paid Secure Checkout Fee (flat)
export const SECURE_CHECKOUT_RATE = 0.04;
export const SECURE_CHECKOUT_FIXED = 0.70;

// No seller-side platform fee — sellers keep the full item + shipping price.
export const PLATFORM_FEE_RATE = 0;

export type PaymentMethod = 'stripe';

export interface FeeBreakdown {
  itemsTotal: number;         // sum of item prices
  shipping: number;           // total shipping
  subtotal: number;           // items + shipping
  secureCheckoutFee: number;  // buyer-paid Secure Checkout Fee
  processingFee: number;      // alias of secureCheckoutFee for backwards compat
  buyerTotal: number;         // what buyer actually pays
  platformFee: number;        // always 0 under current model
  sellerReceives: number;     // payout to seller (full subtotal)
  paymentMethod: PaymentMethod;
  rateLabel: string;          // human label e.g. "4% + $0.70"
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calculateFees(
  itemsTotal: number,
  shipping: number,
  _paymentMethod: PaymentMethod = 'stripe'
): FeeBreakdown {
  const subtotal = itemsTotal + shipping;

  const secureCheckoutFee = r2(subtotal * SECURE_CHECKOUT_RATE + SECURE_CHECKOUT_FIXED);
  const rateLabel = `${(SECURE_CHECKOUT_RATE * 100).toFixed(0)}% + $${SECURE_CHECKOUT_FIXED.toFixed(2)}`;

  const buyerTotal = r2(subtotal + secureCheckoutFee);
  const platformFee = 0;
  const sellerReceives = r2(subtotal);

  return {
    itemsTotal,
    shipping,
    subtotal,
    secureCheckoutFee,
    processingFee: secureCheckoutFee,
    buyerTotal,
    platformFee,
    sellerReceives,
    paymentMethod: 'stripe',
    rateLabel,
  };
}

/** Quick helper for listing previews — sellers now keep the full price + shipping. */
export function sellerEarningsPreview(price: number, shipping = 0): number {
  return r2(price + shipping);
}
