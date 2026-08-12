/**
 * Google OAuth client IDs (public values, not secrets).
 *
 * - `GOOGLE_IOS_CLIENT_ID`: the iOS OAuth client created in Google Cloud for
 *   the Flea bundle id. Required for the native iOS account picker.
 * - `GOOGLE_WEB_CLIENT_ID`: the Web OAuth client already configured as the
 *   backend's Google provider. The native SDK asks Google to mint the ID token
 *   for this audience so the backend accepts it.
 * - `GOOGLE_ANDROID_CLIENT_ID`: optional; Android uses the web client id when
 *   left empty.
 *
 * When the iOS or web client id is empty the app falls back to the in-app
 * browser OAuth flow, so sign-in keeps working either way.
 */

export const GOOGLE_IOS_CLIENT_ID = '';
export const GOOGLE_WEB_CLIENT_ID = '';
export const GOOGLE_ANDROID_CLIENT_ID = '';

/** Reversed iOS client id — this must also be an Info.plist URL scheme. */
export const googleIosUrlScheme = (): string => {
  if (!GOOGLE_IOS_CLIENT_ID) return '';
  const [id, domain] = GOOGLE_IOS_CLIENT_ID.split('.apps.googleusercontent.com');
  if (domain !== undefined && id) return `com.googleusercontent.apps.${id}`;
  return '';
};
