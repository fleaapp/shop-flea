export function heldState(order: any, now = Date.now()): string | null {
  if (order.refunded_at) return null;
  if (order.disputed_at) return 'disputed';
  // A seller declining a claim does not resolve it. Only an admin dismissal,
  // completed refund or closed return removes the request and releases funds.
  if (order.refund_requested_at || (order.return_required_at && !order.return_closed_at)) return 'refund_requested';
  if (order.completed_at) return null;
  if (order.status === 'awaiting' || order.status === 'shipped') return order.status;
  if (order.status === 'delivered') {
    const end = Date.parse(order.dispute_window_ends_at ?? '');
    return !Number.isFinite(end) || end > now ? 'delivered' : null;
  }
  return null;
}

export function heldNetCents(order: any): number {
  return Math.max(0, Math.round((Number(order.price) + Number(order.shipping_price ?? 0)) * 100)
    - Math.round(Number(order.transaction_fee ?? 0) * 100));
}

export async function fetchHeldOrders(client: any, sellerId: string, extra = ''): Promise<any[]> {
  const { data, error } = await client.from('orders')
    .select('id,order_group_id,price,shipping_price,transaction_fee,status,dispute_window_ends_at,refund_requested_at,refunded_at,completed_at,disputed_at,return_required_at,return_closed_at' + extra)
    .eq('seller_id', sellerId).is('refunded_at', null);
  if (error) throw new Error('We could not check protected sales. Please try again.');
  return (data ?? []).filter((order: any) => heldState(order) !== null);
}