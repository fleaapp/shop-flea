import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useAuth } from '@/context/AuthContext';
import { invokeCloudFunction } from '@/utils/cloudFunctions';

/**
 * Registers the iOS device with APNs and stores the token in push_subscriptions
 * with platform = 'ios'. The send-push-notification edge function reads the
 * platform column and dispatches via APNs HTTP/2 instead of web-push.
 *
 * Web push (PWA) is handled by usePushNotifications; this hook is iOS-only
 * and is a no-op on web/Android-browser.
 */
export function useNativePushNotifications() {
  const { user } = useAuth();
  const registeredRef = useRef(false);
  const registeredUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (registeredUserRef.current !== user?.id) {
      registeredRef.current = false;
      registeredUserRef.current = user?.id ?? null;
    }

    if (!user?.id || registeredRef.current) return;
    if (!Capacitor.isNativePlatform()) return;
    if (Capacitor.getPlatform() !== 'ios') return;

    let registrationListener: { remove: () => void } | null = null;
    let errorListener: { remove: () => void } | null = null;
    let appStateListener: { remove: () => void } | null = null;

    const registerNativePush = async () => {
      try {
        let perm = await PushNotifications.checkPermissions();

        // On iOS, trigger the native system prompt on first open so Apple
        // still asks the user directly. Our branded PushPermissionSheet is
        // used as a re-prompt later for users who dismissed or denied.
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
          console.log('[NativePush] Requesting iOS permission on first open');
          perm = await PushNotifications.requestPermissions();
        }

        if (perm.receive !== 'granted') {
          console.log('[NativePush] Permission not granted; waiting for user opt-in');
          return;
        }

        registrationListener = await PushNotifications.addListener(
          'registration',
          async (token) => {
            const apnsToken = token.value;
            if (!apnsToken) return;
            console.log('[NativePush] APNs token received:', apnsToken.slice(0, 12) + '…');

            const { error } = await invokeCloudFunction('register-push-subscription', {
              body: {
                endpoint: apnsToken,
                platform: 'ios',
              },
            });

            if (error) {
              console.error('[NativePush] Failed to save token:', error);
            } else {
              console.log('[NativePush] APNs token saved');
              registeredRef.current = true;
            }
          },
        );

        errorListener = await PushNotifications.addListener(
          'registrationError',
          (err) => {
            console.error('[NativePush] APNs registration error:', err);
          },
        );

        await PushNotifications.register();
      } catch (err) {
        console.error('[NativePush] Setup error:', err);
      }
    };

    void registerNativePush();
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive && !registeredRef.current) {
        void registerNativePush();
      }
    }).then((handle) => {
      appStateListener = handle;
    });

    return () => {
      registrationListener?.remove();
      errorListener?.remove();
      appStateListener?.remove();
    };
  }, [user?.id]);
}
