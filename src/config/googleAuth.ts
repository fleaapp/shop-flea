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

export const GOOGLE_IOS_CLIENT_ID: string =
  '42404177950-hce4tfvr5s19k5qlbiavh5scb0sspqhs.apps.googleusercontent.com';
export const GOOGLE_WEB_CLIENT_ID: string =
  '42404177950-sc85bg7lcklmnelkrf3b88k81ruphqdl.apps.googleusercontent.com';
export const GOOGLE_ANDROID_CLIENT_ID: string = '';


/** Reversed iOS client id — this must also be an Info.plist URL scheme. */
export const googleIosUrlScheme = (): string => {
  const id = GOOGLE_IOS_CLIENT_ID.split('.apps.googleusercontent.com')[0];
  return id ? `com.googleusercontent.apps.${id}` : '';
};

