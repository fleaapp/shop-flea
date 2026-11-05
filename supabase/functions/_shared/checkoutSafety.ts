export function paymentMatchesBuyerCart(pi: any, buyerId: string, itemIds: string[]): boolean {
  const paidIds = String(pi.metadata?.item_ids ?? '').split(',').filter(Boolean).sort();
  const requested = [...new Set(itemIds)].sort();
  return pi.metadata?.flea_buyer_id === buyerId && pi.currency === 'aud'
    && paidIds.length === requested.length && paidIds.every((id, i) => id === requested[i]);
}

export function paymentMatchesQuote(pi: any, quote: any): boolean {
  const destination = typeof pi.transfer_data?.destination === 'string'
    ? pi.transfer_data.destination : pi.transfer_data?.destination?.id;
  return pi.id === quote.payment_intent_id && pi.amount === quote.amount_cents
    && paymentMatchesBuyerCart(pi, quote.buyer_id, quote.items.map((i: any) => i.id))
    && pi.metadata?.flea_seller_id === quote.seller_id
    && (quote.is_reviewer ? pi.capture_method === 'manual' && pi.metadata?.is_apple_reviewer === 'true'
      : destination === quote.seller_account_id);
}

export async function saveCheckoutQuote(client: any, pi: any, quote: any): Promise<void> {
  const { error } = await client.from('checkout_quotes').upsert({
    payment_intent_id: pi.id, ...quote,
  }, { onConflict: 'payment_intent_id', ignoreDuplicates: true });
  if (error) throw new Error('We could not save this checkout. Please try again.');
}