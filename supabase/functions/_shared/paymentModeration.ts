export function unsafePaymentRequest(text: unknown): boolean {
  if (typeof text !== 'string') return true;
  const compact = text.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
  return /(pay|send|transfer|deposit).*(payid|banktransfer|bsb|giftcard|crypto|bitcoin|paypal|outsideflea|offapp)/.test(compact)
    || /(payid|banktransfer|bsb|giftcard|crypto|bitcoin).*(payme|send|transferme|deposit)/.test(compact)
    || /(paypalme|cashapp|paymenow|avoidfleafees)/.test(compact);
}