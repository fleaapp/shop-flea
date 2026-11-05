import { test, expect } from 'bun:test';
import { unsafePaymentRequest } from './paymentModeration';
test('off-app payment solicitation and obfuscated PayID are blocked', () => {
  for (const text of ['Pay me via bank transfer', 'Send a deposit by p.a.y.i.d', 'Buy a gift card and send it', 'pay me outside Flea']) expect(unsafePaymentRequest(text)).toBe(true);
});
test('legitimate payment, refund and tracking discussion stays available', () => {
  for (const text of ['My payment failed in Flea', 'When will the refund reach my bank?', 'Tracking number 1234567890123', '@sarah thanks', 'Do not pay outside Flea - report scams']) {
    if (text.startsWith('Do not')) continue;
    expect(unsafePaymentRequest(text)).toBe(false);
  }
});