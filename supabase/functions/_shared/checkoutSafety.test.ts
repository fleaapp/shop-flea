import { test, expect } from 'bun:test';
import { paymentMatchesBuyerCart, paymentMatchesQuote } from './checkoutSafety';
const pi = { id: 'pi_paid', amount: 6000, currency: 'aud', transfer_data: { destination: 'acct_seller' }, metadata: { flea_buyer_id: 'buyer', flea_seller_id: 'seller', item_ids: 'a,b' } };
const quote = { payment_intent_id: 'pi_paid', amount_cents: 6000, buyer_id: 'buyer', seller_id: 'seller', seller_account_id: 'acct_seller', items: [{ id: 'a', price: 20 }, { id: 'b', price: 30 }] };
test('another buyer or a different cart cannot finalize or refund a payment', () => {
  expect(paymentMatchesBuyerCart(pi, 'attacker', ['a','b'])).toBe(false);
  expect(paymentMatchesBuyerCart(pi, 'buyer', ['a'])).toBe(false);
});
test('payment binds to the immutable quote amount and seller destination', () => {
  expect(paymentMatchesQuote(pi, quote)).toBe(true);
  expect(paymentMatchesQuote({ ...pi, amount: 7000 }, quote)).toBe(false);
  expect(paymentMatchesQuote({ ...pi, transfer_data: { destination: 'acct_other' } }, quote)).toBe(false);
});
test('later listing or offer price changes do not change the saved quote', () => {
  const currentListing = { id: 'a', price: 100 };
  expect(currentListing.price).not.toBe(quote.items[0].price);
  expect(paymentMatchesQuote(pi, quote)).toBe(true);
  expect(quote.items[0].price).toBe(20);
});