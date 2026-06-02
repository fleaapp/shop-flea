import { Capacitor } from '@capacitor/core';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNativePushNotifications } from '@/hooks/useNativePushNotifications';

/**
 * Platform-aware push subscriber.
 * - iOS native build → registers with APNs via Capacitor.
 * - Web/PWA → registers with the browser's Push API + VAPID.
 */
export const PushNotificationSubscriber = () => {
  const isNativeIOS =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

  // Always call both hooks so React's rules-of-hooks order is stable;
  // each hook internally no-ops on the wrong platform.
  usePushNotifications();
  useNativePushNotifications();

  void isNativeIOS;
  return null;
};
