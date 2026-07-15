/**
 * Canonical public URL for the Flea web app. Shared links MUST use this
 * origin (not `window.location.origin`) so that links generated inside the
 * native Capacitor app (capacitor://localhost) or from a preview subdomain
 * still resolve to a real, universally reachable listing page.
 *
 * When the iOS/Android app is installed, this HTTPS URL is intercepted by
 * Universal Links / App Links (configured in the native project via
 * apple-app-site-association and assetlinks.json on this domain) and opens
 * directly inside the app. When the app is not installed, the same URL
 * loads the web listing preview with App Store / Play Store CTAs.
 */
export const CANONICAL_SITE_URL = 'https://app.finditonflea.com';

export const buildListingShareUrl = (listingId: string): string =>
  `${CANONICAL_SITE_URL}/listing/${listingId}`;

export const APP_STORE_URL =
  'https://apps.apple.com/au/app/flea-swipe-shop-sell/id6780890730';
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.finditonflea.app';
