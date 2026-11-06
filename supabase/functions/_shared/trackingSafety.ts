export const normaliseTrackingNumber = (number: string): string => number.replace(/[\s-]+/g, '').toUpperCase();

/** Registration alone accepts arbitrary numbers; require actual, recent carrier evidence. */
export function hasShipmentEvidence(info: { status: string | null; firstScanAt: string | null; deliveredAt: string | null; notFound: boolean; exception: boolean }, purchasedAt: string): boolean {
  const scan = info.firstScanAt ? Date.parse(info.firstScanAt) : NaN;
  const purchase = Date.parse(purchasedAt);
  return !info.notFound && !info.exception && info.status !== 'InfoReceived' && !info.deliveredAt
    && Number.isFinite(scan) && Number.isFinite(purchase) && scan >= purchase && scan <= Date.now();
}