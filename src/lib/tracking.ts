import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

/**
 * Maps a carrier/service-provider name (loose match) to a public tracking URL.
 * AU-focused. Falls back to a Google search when carrier is unknown.
 */
const CARRIER_URL_BUILDERS: Array<{
  match: RegExp;
  build: (n: string) => string;
}> = [
  {
    match: /aus[\s-]?post|australia\s*post/i,
    build: (n) => `https://auspost.com.au/mypost/track/details/${encodeURIComponent(n)}`,
  },
  {
    match: /star[\s-]?track/i,
    build: (n) => `https://startrack.com.au/track/details/${encodeURIComponent(n)}`,
  },
  {
    match: /sendle/i,
    build: (n) => `https://track.sendle.com/tracking?ref=${encodeURIComponent(n)}`,
  },
  {
    match: /aramex|fastway/i,
    build: (n) => `https://www.aramex.com.au/tools/track?l=${encodeURIComponent(n)}`,
  },
  {
    match: /couriers\s*please|cp\b/i,
    build: (n) =>
      `https://www.couriersplease.com.au/tools-resources/track-trace?Reference=${encodeURIComponent(n)}`,
  },
  {
    match: /tnt/i,
    build: (n) =>
      `https://www.tnt.com/express/en_au/site/shipping-tools/tracking.html?searchType=con&cons=${encodeURIComponent(n)}`,
  },
  {
    match: /dhl/i,
    build: (n) =>
      `https://www.dhl.com/au-en/home/tracking.html?tracking-id=${encodeURIComponent(n)}`,
  },
  {
    match: /toll/i,
    build: (n) =>
      `https://www.tollgroup.com/tools/track-trace?id=${encodeURIComponent(n)}`,
  },
  {
    match: /fedex/i,
    build: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
  },
];

/**
 * Lightweight carrier detection from the tracking number alone.
 * Used when no provider is stored. AU-focused heuristics.
 */
export function detectCarrierFromNumber(num: string): string | null {
  const n = num.replace(/\s+/g, '').toUpperCase();
  if (!n) return null;
  // AusPost domestic: starts with letters then digits, often 10-39 chars
  if (/^[A-Z]{2}\d{9}AU$/.test(n)) return 'Australia Post';
  if (/^33[A-Z0-9]{8,}$/.test(n)) return 'Australia Post';
  if (/^[A-Z]{3}\d{7,}$/.test(n)) return 'Australia Post';
  // Sendle: typically S followed by alphanumeric
  if (/^S[A-Z0-9]{6,}$/.test(n)) return 'Sendle';
  // StarTrack: numeric 12-15
  if (/^\d{12,15}$/.test(n)) return 'StarTrack';
  // Aramex / Fastway: starts with A
  if (/^A\d{10,}$/.test(n)) return 'Aramex';
  return null;
}

export function getTrackingUrl(provider: string | null | undefined, number: string): string {
  const num = (number || '').trim();
  const prov = (provider || '').trim() || detectCarrierFromNumber(num) || '';
  const builder = CARRIER_URL_BUILDERS.find((b) => b.match.test(prov));
  if (builder) return builder.build(num);
  // Fallback: Google search so user always lands somewhere useful.
  const q = encodeURIComponent(`${prov} tracking ${num}`.trim());
  return `https://www.google.com/search?q=${q}`;
}

/**
 * Opens a URL inside the app (in-app browser on native, popup on web).
 * On native platforms uses Capacitor Browser (SFSafariViewController on iOS,
 * Chrome Custom Tabs on Android) — the user never leaves the app.
 * On web we open a new tab as a fallback (carrier sites block iframes).
 */
export async function openTrackingUrl(provider: string | null | undefined, number: string) {
  const url = getTrackingUrl(provider, number);
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url, presentationStyle: 'popover' });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
