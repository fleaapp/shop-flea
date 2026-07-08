import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

/**
 * Opens a URL inside the app experience.
 * - Native (iOS/Android): SFSafariViewController / Chrome Custom Tab via Capacitor Browser.
 *   Optional `onFinished` fires when the user dismisses the in-app browser.
 * - Web: same-tab navigation for full-page flows (Stripe hosted onboarding),
 *   or `_blank` when `newTabOnWeb` is true (dashboard-style side trips).
 */
export async function openInAppUrl(
  url: string,
  opts: { newTabOnWeb?: boolean; onFinished?: () => void } = {},
) {
  const { newTabOnWeb = false, onFinished } = opts;

  if (Capacitor.isNativePlatform()) {
    if (onFinished) {
      const listener = await Browser.addListener('browserFinished', () => {
        listener.remove();
        onFinished();
      });
    }
    await Browser.open({ url, presentationStyle: 'popover' });
    return;
  }

  if (newTabOnWeb) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    window.location.assign(url);
  }
}
