import { test, expect } from 'bun:test';
import { heldState, heldNetCents, fetchHeldOrders } from './heldFunds';
import { refundOrderIds, sellerCanRefund } from './refundSafety';

test('a partial item refund never marks its shipped sibling refunded', () => {
  expect(refundOrderIds('refund.created', { status: 'succeeded', metadata: { flea_mode: 'single', flea_order_id: 'a' } }, [{ id: 'a' }, { id: 'b' }])).toEqual(['a']);
  expect(refundOrderIds('charge.refunded', { refunded: false }, [{ id: 'a' }, { id: 'b' }])).toEqual([]);
});
test('pending and failed provider refunds do not mark orders refunded', () => {
  for (const status of ['pending', 'failed']) expect(refundOrderIds('refund.updated', { status, metadata: { flea_mode: 'single', flea_order_id: 'a' } }, [{ id: 'a' }])).toEqual([]);
});
test('declined refund stays held even when the order was completed', () => {
  expect(heldState({ completed_at: '2026-11-01', refund_requested_at: '2026-11-02', refund_declined_at: '2026-11-03' })).toBe('refund_requested');
});
test('bank disputes hold completed sales', () => {
  expect(heldState({ completed_at: '2026-11-01', disputed_at: '2026-11-02' })).toBe('disputed');
});
test('dashboard and payout hold the seller net, not gross', () => {
  expect(heldNetCents({ price: 50, shipping_price: 10, transaction_fee: 1.7 })).toBe(5830);
});
test('protected sales lookup failure cannot allow withdrawal', async () => {
  const q: any = { select: () => q, eq: () => q, is: async () => ({ error: { message: 'unavailable' } }) };
  await expect(fetchHeldOrders({ from: () => q }, 'seller')).rejects.toThrow();
});
test('seller can approve throughout the promised 14 day response window', () => {
  expect(sellerCanRefund({ delivered_at: '2026-10-20', refund_requested_at: '2026-10-21', refund_request_deadline_at: '2026-11-04' }, Date.parse('2026-11-03'))).toBe(true);
  expect(sellerCanRefund({ delivered_at: '2026-10-01' }, Date.parse('2026-11-03'))).toBe(false);
});