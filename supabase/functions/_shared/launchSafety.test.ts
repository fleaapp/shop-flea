import { describe, expect, test } from 'bun:test';
import { matchesServiceCredential } from './internalAuth';
import { hasShipmentEvidence } from './trackingSafety';

describe('internal tools', () => {
  test('forged service role payload is not authorization', () => {
    expect(matchesServiceCredential('Bearer header.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.fake', 'actual-server-credential')).toBe(false);
    expect(matchesServiceCredential('Bearer actual-server-credential', 'actual-server-credential')).toBe(true);
    expect(matchesServiceCredential('Bearer ', undefined)).toBe(false);
  });
});
describe('outbound parcels', () => {
  const base = { status: 'InTransit', firstScanAt: '2026-11-05T12:00:00Z', deliveredAt: null, notFound: false, exception: false };
  test('requires a carrier scan after purchase', () => {
    expect(hasShipmentEvidence(base, '2026-11-05T10:00:00Z')).toBe(true);
    expect(hasShipmentEvidence(base, '2026-11-05T13:00:00Z')).toBe(false);
    expect(hasShipmentEvidence({ ...base, firstScanAt: null }, '2026-11-05T10:00:00Z')).toBe(false);
  });
  test('rejects already delivered, missing and label-only parcels', () => {
    for (const patch of [{ deliveredAt: '2026-11-05T14:00:00Z' }, { notFound: true }, { status: 'InfoReceived' }]) {
      expect(hasShipmentEvidence({ ...base, ...patch }, '2026-11-05T10:00:00Z')).toBe(false);
    }
  });
});