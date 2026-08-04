export interface TransactionOrder {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  order_group_id: string | null;
  price: number;
  shipping_price: number;
  status: string;
  tracking_number: string | null;
  tracking_provider: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  refunded_at?: string | null;
  refund_reason?: string | null;
  created_at: string;
  order_number?: string | null;
  updated_at: string;
  listing?: { title: string; images: string[]; brand: string; category: string };
  buyer_profile?: { username: string; avatar_url: string | null };
  seller_profile?: { username: string; avatar_url: string | null };
  message_count?: number;
  has_flags?: boolean;
}

export interface TransactionSummary {
  totalOrders: number;
  totalRevenue: number;
  platformEarnings: number;
  refundTotal: number;
  ordersInProgress: number;
  overdueShipments: number;
  disputedOrders: number;
}

export interface TransactionFilters {
  dateFrom: string | null;
  dateTo: string | null;
  status: string | null;
  shippingStatus: string | null;
  flagged: boolean;
  overdue: boolean;
  search: string;
}

export type TransactionSortField = 'created_at' | 'price' | 'status' | 'buyer' | 'seller';
export type SortDirection = 'asc' | 'desc';

// Flea revenue per sale = Secure Checkout Fee (buyer) + Transaction Fee (seller).
export const SECURE_CHECKOUT_RATE = 0.04;
export const SECURE_CHECKOUT_FIXED = 0.70;
export const TRANSACTION_FEE_RATE = 0.02;
export const TRANSACTION_FEE_FIXED = 0.50;
export const PLATFORM_FEE_PERCENT = SECURE_CHECKOUT_RATE;

/** Buyer-paid Secure Checkout Fee. Pass items + shipping. */
export function calcSecureCheckoutFee(subtotal: number): number {
  return Math.round((subtotal * SECURE_CHECKOUT_RATE + SECURE_CHECKOUT_FIXED) * 100) / 100;
}
/** Seller-paid Transaction Fee. Pass items + shipping. */
export function calcTransactionFee(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return Math.round((subtotal * TRANSACTION_FEE_RATE + TRANSACTION_FEE_FIXED) * 100) / 100;
}
/** Total Flea revenue (Secure Checkout Fee + Transaction Fee) per sale. */
export function calcPlatformFee(subtotal: number): number {
  return Math.round((calcSecureCheckoutFee(subtotal) + calcTransactionFee(subtotal)) * 100) / 100;
}
/** Est. Stripe processing cost on a charge total (buyer-facing). */
export function calcProcessingFee(total: number): number {
  return Math.round((total * 0.0175 + 0.30) * 100) / 100;
}
export function getShippingStatus(o: TransactionOrder): 'pending' | 'shipped' | 'delivered' {
  if (o.delivered_at) return 'delivered';
  if (o.shipped_at) return 'shipped';
  return 'pending';
}
export function getDaysOverdue(o: TransactionOrder, deadlineDays = 5): number | null {
  if (o.shipped_at || o.delivered_at) return null;
  if (o.status === 'cancelled' || o.refunded_at) return null;
  const created = new Date(o.created_at);
  const deadline = new Date(created.getTime() + deadlineDays * 86400000);
  const now = new Date();
  if (now <= deadline) return null;
  return Math.floor((now.getTime() - deadline.getTime()) / 86400000);
}

export function getTransactionStatus(o: TransactionOrder): string {
  return o.refunded_at ? 'refunded' : o.status;
}
export function getOrderCode(order: string | { id: string; order_number?: string | null }): string {
  if (typeof order === 'string') return `FLA-${order.substring(0, 8).toUpperCase()}`;
  return order.order_number || `FLA-${order.id.substring(0, 8).toUpperCase()}`;
}
