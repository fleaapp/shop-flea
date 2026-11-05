export function refundOrderIds(eventType: string, payload: any, orders: Array<{ id: string }>): string[] {
  if (eventType === 'charge.refunded') {
    return payload.refunded === true ? orders.map(o => o.id) : [];
  }
  if (payload.status !== 'succeeded') return [];
  if (payload.metadata?.flea_mode === 'single') {
    return orders.filter(o => o.id === payload.metadata.flea_order_id).map(o => o.id);
  }
  // Full-charge events reconcile unscoped dashboard refunds. Never infer that
  // all items were refunded from an unscoped partial refund.
  return [];
}

export function sellerCanRefund(order: any, now = Date.now()): boolean {
  if (order.refund_requested_at) return true;
  const base = Date.parse(order.delivered_at ?? order.created_at ?? '');
  return Number.isFinite(base) && now - base <= (order.delivered_at ? 16 : 30) * 86400000;
}