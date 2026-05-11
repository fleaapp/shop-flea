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
  created_at: string;
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

export const PLATFORM_FEE_PERCENT = 0.07;
export const PROCESSING_FEE_PERCENT = 0.029;
export const PROCESSING_FEE_FIXED = 0.30;

export function calcPlatformFee(price: number): number {
  return Math.round(price * PLATFORM_FEE_PERCENT * 100) / 100;
}
export function calcProcessingFee(total: number): number {
  return Math.round((total * PROCESSING_FEE_PERCENT + PROCESSING_FEE_FIXED) * 100) / 100;
}
export function getShippingStatus(o: TransactionOrder): 'pending' | 'shipped' | 'delivered' {
  if (o.delivered_at) return 'delivered';
  if (o.shipped_at) return 'shipped';
  return 'pending';
}
export function getDaysOverdue(o: TransactionOrder, deadlineDays = 5): number | null {
  if (o.shipped_at || o.delivered_at) return null;
  if (o.status === 'cancelled' || o.status === 'refunded') return null;
  const created = new Date(o.created_at);
  const deadline = new Date(created.getTime() + deadlineDays * 86400000);
  const now = new Date();
  if (now <= deadline) return null;
  return Math.floor((now.getTime() - deadline.getTime()) / 86400000);
}
export function getOrderCode(orderId: string): string {
  return `FLA-${orderId.substring(0, 8).toUpperCase()}`;
}
