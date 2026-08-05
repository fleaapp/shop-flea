/**
 * The Australian carriers Flea supports for tracked shipping.
 * Every entry maps to a tracking-provider carrier code so live scans work.
 * Sellers pick from this list - no free text, no "Other".
 */
export interface AuCarrier {
  /** Stored on the order as tracking_provider */
  name: string;
  /** 17track numeric carrier code */
  code: number;
  /** Accepted tracking number formats (already uppercased, spaces stripped) */
  patterns: RegExp[];
  /** Shown under the input when the number doesn't match */
  hint: string;
}

export const AU_CARRIERS: AuCarrier[] = [
  {
    name: 'Australia Post',
    code: 100002,
    patterns: [
      /^[A-Z]{2}\d{9}AU$/,
      /^33[A-Z0-9]{8,}$/,
      /^[A-Z]{3}\d{7,}$/,
      /^\d{10,}$/,
    ],
    hint: 'Australia Post numbers look like AA123456789AU or start with 33.',
  },
  {
    name: 'StarTrack',
    code: 100530,
    patterns: [/^[A-Z0-9]{8,20}$/],
    hint: 'StarTrack consignment numbers are 8-20 letters or digits.',
  },
  {
    name: 'CouriersPlease',
    code: 100286,
    patterns: [/^[A-Z0-9]{7,20}$/],
    hint: 'CouriersPlease numbers are 7-20 letters or digits.',
  },
  {
    name: 'TNT',
    code: 100006,
    patterns: [/^[A-Z0-9]{8,20}$/],
    hint: 'TNT consignment numbers are 8-20 letters or digits.',
  },
  {
    name: 'Toll',
    code: 100325,
    patterns: [/^[A-Z0-9]{8,20}$/],
    hint: 'Toll connote numbers are 8-20 letters or digits.',
  },
  {
    name: 'DHL Express',
    code: 100001,
    patterns: [/^\d{10,12}$/, /^[A-Z]{3}\d{7,}$/],
    hint: 'DHL Express waybill numbers are 10-12 digits.',
  },
];

export const AU_CARRIER_NAMES = AU_CARRIERS.map((c) => c.name);

export function findAuCarrier(name?: string | null): AuCarrier | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return AU_CARRIERS.find((c) => c.name.toLowerCase() === n);
}

export function normaliseTrackingNumber(value: string): string {
  return value.replace(/[\s-]+/g, '').toUpperCase();
}

/** Local format check. Returns an error message, or null when the format is fine. */
export function validateTrackingFormat(carrierName: string, rawNumber: string): string | null {
  const carrier = findAuCarrier(carrierName);
  if (!carrier) return 'Please choose a carrier';
  const num = normaliseTrackingNumber(rawNumber);
  if (!num) return 'Please enter a tracking number';
  if (num.length < 7) return 'That tracking number looks too short';
  if (!carrier.patterns.some((p) => p.test(num))) return carrier.hint;
  return null;
}
