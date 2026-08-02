import type { BundleShippingMode } from './shippingCalculator';
import { calculateBundleShippingTotal } from './shippingCalculator';

/**
 * Single source of truth for Flea's fee model.
 *
 * Money flow per sale:
 *  Buyer pays:    items + shipping + Secure Checkout Fee (4% + $0.70)
 *  Seller earns:  items + shipping − Transaction Fee (2% + $0.50)
 *  Flea revenue:  Secure Checkout Fee + Transaction Fee − payment processing cost
 *
 * Sellers pay no selling fees - the Transaction Fee only covers payment processing per completed sale.
 */

// Buyer-paid Secure Checkout Fee
export const SECURE_CHECKOUT_RATE = 0.04;
export const SECURE_CHECKOUT_FIXED = 0.70;

// Seller-paid Transaction Fee (deducted from payout)
export const TRANSACTION_FEE_RATE = 0.02;
export const TRANSACTION_FEE_FIXED = 0.50;

/**
 * Minimum listing price. Below this the fixed portions of the fees make the
 * application fee larger than the charge itself, which Stripe rejects outright.
 */
export const MIN_LISTING_PRICE = 3;

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

export function calculateSecureCheckoutFee(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return r2(subtotal * SECURE_CHECKOUT_RATE + SECURE_CHECKOUT_FIXED);
}

export function calculateFees(
  itemsTotal: number,
  shipping: number,
  _paymentMethod: PaymentMethod = 'stripe'
): FeeBreakdown {
  const subtotal = itemsTotal + shipping;

  const secureCheckoutFee = calculateSecureCheckoutFee(subtotal);
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

/**
 * Quick helper for listing previews — seller take-home after the transaction fee
 * IF the item sells on its own. The $0.50 fixed portion is charged once per
 * order, so a multi-item bundle keeps more than the sum of these previews.
 */
export function sellerEarningsPreview(price: number, shipping = 0): number {
  const subtotal = price + shipping;
  return r2(subtotal - calculateTransactionFee(subtotal));
}

export interface ProRataRefundShare {
  itemSubtotal: number;       // price + this item's share of bundle shipping
  secureFeeShare: number;     // buyer-paid fee returned to buyer
  transactionFeeShare: number;// seller-paid fee clawed back from seller
  buyerRefund: number;        // total returned to buyer (itemSubtotal + secureFeeShare)
  sellerNet: number;          // amount reversed from seller transfer (itemSubtotal - transactionFeeShare)
}

/**
 * Calculates the buyer refund and seller transfer reversal for a single item
 * within a bundle. Shipping is split pro-rata by each item's raw listing
 * shipping, then bundle discounts/free-shipping rules are applied to the total.
 * Fees are split proportionally by each item's share of the post-shipping subtotal.
 */
export function calculateProRataRefund(
  itemIndex: number,
  items: { price: number; rawShipping: number }[],
  bundleMode: BundleShippingMode,
  discountPercent: number | null,
  /**
   * Fees ACTUALLY charged on the order, snapshotted at checkout. Always pass
   * these when available — recalculating ignores coupons (e.g. FREEFLEA) and
   * would refund a fee that was never collected.
   */
  actualFees?: { secureCheckoutFee?: number | null; transactionFee?: number | null },
): ProRataRefundShare {
  if (!items.length) {
    return { itemSubtotal: 0, secureFeeShare: 0, transactionFeeShare: 0, buyerRefund: 0, sellerNet: 0 };
  }

  const rawShippingTotal = r2(items.reduce((sum, i) => sum + (Number(i.rawShipping) || 0), 0));
  const bundleShippingTotal = calculateBundleShippingTotal(
    items.map((i) => Number(i.rawShipping) || 0),
    bundleMode,
    discountPercent
  );

  const itemShippingShare = rawShippingTotal > 0
    ? r2(bundleShippingTotal * ((items[itemIndex].rawShipping || 0) / rawShippingTotal))
    : 0;

  const itemSubtotals = items.map((i) =>
    r2((Number(i.price) || 0) + (rawShippingTotal > 0
      ? r2(bundleShippingTotal * ((Number(i.rawShipping) || 0) / rawShippingTotal))
      : 0))
  );

  const itemSubtotal = itemSubtotals[itemIndex];
  const groupSubtotal = r2(itemSubtotals.reduce((sum, s) => sum + s, 0));

  const secureFee = actualFees?.secureCheckoutFee != null
    ? r2(Number(actualFees.secureCheckoutFee))
    : calculateSecureCheckoutFee(groupSubtotal);
  const transactionFee = actualFees?.transactionFee != null
    ? r2(Number(actualFees.transactionFee))
    : calculateTransactionFee(groupSubtotal);

  const secureFeeShare = groupSubtotal > 0 ? r2(secureFee * (itemSubtotal / groupSubtotal)) : 0;
  const transactionFeeShare = groupSubtotal > 0 ? r2(transactionFee * (itemSubtotal / groupSubtotal)) : 0;

  const buyerRefund = r2(itemSubtotal + secureFeeShare);
  const sellerNet = Math.max(0, r2(itemSubtotal - transactionFeeShare));

  return { itemSubtotal, secureFeeShare, transactionFeeShare, buyerRefund, sellerNet };
}

export interface SellerNetSummary {
  activeOrders: any[];
  refundedOrders: any[];
  subtotal: number;        // items + shipping for non-refunded items only
  shipping: number;        // shipping for non-refunded items only
  transactionFee: number;  // fee actually charged, refunded items excluded
  youReceived: number;     // subtotal - transactionFee
  fullyRefunded: boolean;
  partiallyRefunded: boolean;
}

/**
 * Single source of truth for what a seller actually keeps on an order group.
 *
 * Refunded items are excluded entirely (their transfer is reversed in Stripe),
 * and the Transaction Fee is read from the snapshot stored on each order at
 * checkout. Recalculating with today's rate would re-price historical orders
 * and invent fees that were never charged.
 */
export function computeSellerNet<T extends {
  price?: number | null;
  shipping_price?: number | null;
  status?: string | null;
  refunded_at?: string | null;
  transaction_fee?: number | null;
}>(orders: T[] | null | undefined): SellerNetSummary {
  const all = orders ?? [];
  const refundedOrders = all.filter((o) => o.status === 'refunded' || !!o.refunded_at);
  const activeOrders = all.filter((o) => !(o.status === 'refunded' || !!o.refunded_at));

  const shipping = r2(activeOrders.reduce((s, o) => s + (Number(o.shipping_price) || 0), 0));
  const subtotal = r2(activeOrders.reduce(
    (s, o) => s + (Number(o.price) || 0) + (Number(o.shipping_price) || 0), 0));

  // Only ever trust the snapshot written at checkout. A missing snapshot means
  // no fee was charged (pre-fee order) - recalculating would invent a deduction
  // that can never be reconciled against Stripe.
  const transactionFee = r2(activeOrders.reduce((s, o) => s + (Number(o.transaction_fee) || 0), 0));

  return {
    activeOrders,
    refundedOrders,
    subtotal,
    shipping,
    transactionFee,
    youReceived: r2(subtotal - transactionFee),
    fullyRefunded: all.length > 0 && activeOrders.length === 0,
    partiallyRefunded: refundedOrders.length > 0 && activeOrders.length > 0,
  };
}
