import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

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

  useEffect(() => {
    if (!user?.id || registeredRef.current) return;
    if (!Capacitor.isNativePlatform()) return;
    if (Capacitor.getPlatform() !== 'ios') return;

    let registrationListener: { remove: () => void } | null = null;
    let errorListener: { remove: () => void } | null = null;

    (async () => {
      try {
        const perm = await PushNotifications.checkPermissions();
        let granted = perm.receive === 'granted';
        if (!granted) {
          const req = await PushNotifications.requestPermissions();
          granted = req.receive === 'granted';
        }
        if (!granted) {
          console.log('[NativePush] Permission denied');
          return;
        }

        registrationListener = await PushNotifications.addListener(
          'registration',
          async (token) => {
            const apnsToken = token.value;
            if (!apnsToken) return;
            console.log('[NativePush] APNs token received:', apnsToken.slice(0, 12) + '…');

            // Replace any prior ios subscriptions for this user
            await (supabase as any)
              .from('push_subscriptions')
              .delete()
              .eq('user_id', user.id)
              .eq('platform', 'ios');

            const { error } = await (supabase as any)
              .from('push_subscriptions')
              .insert({
                user_id: user.id,
                endpoint: apnsToken,
                platform: 'ios',
                updated_at: new Date().toISOString(),
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
    })();

    return () => {
      registrationListener?.remove();
      errorListener?.remove();
    };
  }, [user?.id]);
}
