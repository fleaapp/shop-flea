/**
 * Lightweight analytics event emitter. Currently logs to console with a
 * consistent prefix so events show up in device logs and can be scraped
 * during Apple review. Replace the impl with a real provider (PostHog,
 * Segment, etc) without touching call sites.
 */
export type AnalyticsEvent =
  | 'id_verification_started'
  | 'id_verification_captured'
  | 'id_verification_uploaded'
  | 'id_verification_submitted'
  | 'id_verification_stripe_verified'
  | 'id_verification_stripe_rejected'
  | 'id_verification_edit_name_opened';

export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}) {
  try {
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${event}`, props);
  } catch {
    /* noop */
  }
}
