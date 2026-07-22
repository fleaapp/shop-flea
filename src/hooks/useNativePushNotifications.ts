import { useCallback, useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useAuth } from '@/context/AuthContext';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { logError } from '@/lib/errorLogger';

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
  const lastSavedTokenRef = useRef<string | null>(null);
  const lastSavedAtRef = useRef(0);
  const saveInFlightRef = useRef(false);

  const saveNativeToken = useCallback(async (apnsToken: string, reason: string) => {
    if (!user?.id || !apnsToken) return;

    const now = Date.now();
    if (
      saveInFlightRef.current ||
      (lastSavedTokenRef.current === apnsToken && now - lastSavedAtRef.current < 30_000)
    ) {
      return;
    }

    saveInFlightRef.current = true;
    try {
      console.log('[NativePush] Saving APNs token:', { reason, userId: user.id });
      const { error } = await invokeCloudFunction('register-push-subscription', {
        body: {
          endpoint: apnsToken,
          platform: 'ios',
        },
      });

      if (error) {
        console.error('[NativePush] Failed to save token:', error);
        void logError({
          title: 'Native push token save failed',
          message: error.message || 'register-push-subscription failed',
          severity: 'warning',
          source: 'client',
          context: {
            reason,
            user_id: user.id,
            platform: Capacitor.getPlatform(),
          },
        });
        return;
      }

      lastSavedTokenRef.current = apnsToken;
      lastSavedAtRef.current = Date.now();
      console.log('[NativePush] APNs token saved');
    } catch (err) {
      console.error('[NativePush] Token save exception:', err);
      void logError({
        title: 'Native push token save exception',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack ?? null : null,
        severity: 'warning',
        source: 'client',
        context: {
          reason,
          user_id: user.id,
          platform: Capacitor.getPlatform(),
        },
      });
    } finally {
      saveInFlightRef.current = false;
    }
  }, [user?.id]);

  useEffect(() => {
    lastSavedTokenRef.current = null;
    lastSavedAtRef.current = 0;
    saveInFlightRef.current = false;

    if (!user?.id) return;
    if (!Capacitor.isNativePlatform()) return;
    if (Capacitor.getPlatform() !== 'ios') return;

    let registrationListener: { remove: () => void } | null = null;
    let errorListener: { remove: () => void } | null = null;
    let appStateListener: { remove: () => void } | null = null;

    const registerNativePush = async (reason: string) => {
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

        console.log('[NativePush] Registering with APNs:', reason);
        await PushNotifications.register();
      } catch (err) {
        console.error('[NativePush] Setup error:', err);
        void logError({
          title: 'Native push setup failed',
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack ?? null : null,
          severity: 'warning',
          source: 'client',
          context: {
            reason,
            user_id: user.id,
            platform: Capacitor.getPlatform(),
          },
        });
      }
    };

    void PushNotifications.addListener('registration', (token) => {
      const apnsToken = token.value;
      if (!apnsToken) return;
      console.log('[NativePush] APNs token received:', apnsToken.slice(0, 12) + '…');
      void saveNativeToken(apnsToken, 'registration');
    }).then((handle) => {
      registrationListener = handle;
    });

    void PushNotifications.addListener('registrationError', (err) => {
      console.error('[NativePush] APNs registration error:', err);
      void logError({
        title: 'Native APNs registration error',
        message: typeof err === 'object' && err && 'error' in err ? String((err as { error?: unknown }).error) : JSON.stringify(err),
        severity: 'warning',
        source: 'client',
        context: {
          user_id: user.id,
          platform: Capacitor.getPlatform(),
        },
      });
    }).then((handle) => {
      errorListener = handle;
    });

    void registerNativePush('mount');
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void registerNativePush('foreground');
      }
    }).then((handle) => {
      appStateListener = handle;
    });

    return () => {
      registrationListener?.remove();
      errorListener?.remove();
      appStateListener?.remove();
    };
  }, [saveNativeToken, user?.id]);
}
