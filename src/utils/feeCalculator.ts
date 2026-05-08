/**
 * Single source of truth for Flea's fee model.
 *
 * Money flow per sale:
 *  Buyer pays:    items + shipping + processing fee (covers payment provider's actual cost)
 *  Stripe takes:  ~1.75% + $0.30 of total charge — deducted from SELLER (on_behalf_of=seller)
 *  Flea takes:    7% of (items + shipping) — application_fee_amount
 *  Seller gets:   (items + shipping) − 7% Flea fee  (Stripe fees absorbed by buyer-paid line)
 *
 * The processing fee shown to the buyer is "grossed up" so Stripe's actual
 * deduction is fully covered. Formula:
 *   processingFee = (subtotal + 0.30) / (1 − 0.0175) − subtotal
 */

// Buyer-paid processing fee (Stripe AU domestic card)
export const STRIPE_PROCESSING_RATE = 0.0175;
export const STRIPE_PROCESSING_FIXED = 0.30;

// PayPal AU domestic Checkout standard rate — same gross-up model as Stripe
// so PayPal's actual deduction is fully covered by the buyer-paid fee.
export const PAYPAL_PROCESSING_RATE = 0.026;
export const PAYPAL_PROCESSING_FIXED = 0.30;

// Flea platform fee — what the seller pays out of the sale
export const PLATFORM_FEE_RATE = 0.07;

export type PaymentMethod = 'stripe' | 'paypal';

export interface FeeBreakdown {
  itemsTotal: number;       // sum of item prices
  shipping: number;         // total shipping
  subtotal: number;         // items + shipping
  processingFee: number;    // buyer-paid, grossed up
  buyerTotal: number;       // what buyer actually pays
  platformFee: number;      // 7% Flea fee
  sellerReceives: number;   // payout to seller (after Stripe + Flea fee)
  paymentMethod: PaymentMethod;
  rateLabel: string;        // human label e.g. "1.75% + $0.30"
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calculateFees(
  itemsTotal: number,
  shipping: number,
  paymentMethod: PaymentMethod = 'stripe'
): FeeBreakdown {
  const subtotal = itemsTotal + shipping;

  let processingFee: number;
  let rateLabel: string;

  if (paymentMethod === 'paypal') {
    processingFee = subtotal * PAYPAL_PROCESSING_RATE + PAYPAL_PROCESSING_FIXED;
    rateLabel = `${(PAYPAL_PROCESSING_RATE * 100).toFixed(0)}%`;
  } else {
    // Gross-up so Stripe's deduction (rate × buyerTotal + fixed) is fully covered.
    processingFee = (subtotal + STRIPE_PROCESSING_FIXED) / (1 - STRIPE_PROCESSING_RATE) - subtotal;
    rateLabel = `${(STRIPE_PROCESSING_RATE * 100).toFixed(2)}% + $${STRIPE_PROCESSING_FIXED.toFixed(2)}`;
  }

  processingFee = r2(processingFee);
  const buyerTotal = r2(subtotal + processingFee);
  const platformFee = r2(subtotal * PLATFORM_FEE_RATE);
  // For display only — actual seller payout is computed by Stripe after fees.
  const sellerReceives = r2(subtotal - platformFee);

  return {
    itemsTotal,
    shipping,
    subtotal,
    processingFee,
    buyerTotal,
    platformFee,
    sellerReceives,
    paymentMethod,
    rateLabel,
  };
}

/** Quick helper for listing previews — what seller keeps after Flea's 7%. */
export function sellerEarningsPreview(price: number, shipping = 0): number {
  return r2((price + shipping) * (1 - PLATFORM_FEE_RATE));
}
