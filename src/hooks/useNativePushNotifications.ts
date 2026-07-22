import { useCallback, useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useAuth } from '@/context/AuthContext';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { logError } from '@/lib/errorLogger';

type NativePushEvent =
  | 'setup-started'
  | 'permission-checked'
  | 'permission-requested'
  | 'permission-not-granted'
  | 'registration-requested'
  | 'registration-callback-timeout'
  | 'token-received'
  | 'token-save-started'
  | 'token-save-succeeded';

const logNativePushState = (
  event: NativePushEvent,
  context: Record<string, unknown>,
  severity: 'warning' | 'error' = 'warning',
) => {
  void logError({
    title: `Native push ${event}`,
    message: event,
    severity,
    source: 'client',
    context,
  });
};

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
  const pendingRegistrationRef = useRef<{ requestedAt: number; reason: string } | null>(null);
  const registrationTimeoutRef = useRef<number | null>(null);

  const clearRegistrationTimeout = useCallback(() => {
    if (registrationTimeoutRef.current !== null) {
      window.clearTimeout(registrationTimeoutRef.current);
      registrationTimeoutRef.current = null;
    }
    pendingRegistrationRef.current = null;
  }, []);

  const startRegistrationTimeout = useCallback((reason: string, userId: string) => {
    clearRegistrationTimeout();
    pendingRegistrationRef.current = { requestedAt: Date.now(), reason };
    registrationTimeoutRef.current = window.setTimeout(() => {
      const pending = pendingRegistrationRef.current;
      if (!pending) return;
      logNativePushState('registration-callback-timeout', {
        reason: pending.reason,
        user_id: userId,
        platform: Capacitor.getPlatform(),
        elapsed_ms: Date.now() - pending.requestedAt,
        likely_fix: 'Run scripts/setup-ios-native.sh so AppDelegate forwards APNs callbacks to Capacitor.',
      }, 'error');
    }, 12_000);
  }, [clearRegistrationTimeout]);

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
      logNativePushState('token-save-started', {
        reason,
        user_id: user.id,
        platform: Capacitor.getPlatform(),
        token_prefix: apnsToken.slice(0, 12),
      });

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
      logNativePushState('token-save-succeeded', {
        reason,
        user_id: user.id,
        platform: Capacitor.getPlatform(),
        token_prefix: apnsToken.slice(0, 12),
      });
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

    logNativePushState('setup-started', {
      user_id: user.id,
      platform: Capacitor.getPlatform(),
    });

    let registrationListener: { remove: () => void } | null = null;
    let errorListener: { remove: () => void } | null = null;
    let appStateListener: { remove: () => void } | null = null;

    const registerNativePush = async (reason: string) => {
      try {
        let perm = await PushNotifications.checkPermissions();
        console.log('[NativePush] Permission status:', perm.receive, reason);
        logNativePushState('permission-checked', {
          reason,
          user_id: user.id,
          platform: Capacitor.getPlatform(),
          permission: perm.receive,
        });

        // On iOS, trigger the native system prompt on first open so Apple
        // still asks the user directly. Our branded PushPermissionSheet is
        // used as a re-prompt later for users who dismissed or denied.
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
          console.log('[NativePush] Requesting iOS permission on first open');
          perm = await PushNotifications.requestPermissions();
          logNativePushState('permission-requested', {
            reason,
            user_id: user.id,
            platform: Capacitor.getPlatform(),
            permission: perm.receive,
          });
        }

        if (perm.receive !== 'granted') {
          console.log('[NativePush] Permission not granted; waiting for user opt-in');
          logNativePushState('permission-not-granted', {
            reason,
            user_id: user.id,
            platform: Capacitor.getPlatform(),
            permission: perm.receive,
          });
          return;
        }

        console.log('[NativePush] Registering with APNs:', reason);
        logNativePushState('registration-requested', {
          reason,
          user_id: user.id,
          platform: Capacitor.getPlatform(),
        });
        startRegistrationTimeout(reason, user.id);
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

    let cancelled = false;

    const setup = async () => {
      registrationListener = await PushNotifications.addListener('registration', (token) => {
        clearRegistrationTimeout();
        const apnsToken = token.value;
        if (!apnsToken) return;
        console.log('[NativePush] APNs token received:', apnsToken.slice(0, 12) + '…');
        logNativePushState('token-received', {
          user_id: user.id,
          platform: Capacitor.getPlatform(),
          token_prefix: apnsToken.slice(0, 12),
        });
        void saveNativeToken(apnsToken, 'registration');
      });

      errorListener = await PushNotifications.addListener('registrationError', (err) => {
        clearRegistrationTimeout();
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
      });

      if (cancelled) return;
      await registerNativePush('mount');

      appStateListener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          void registerNativePush('foreground');
        }
      });
    };

    void setup().catch((err) => {
      console.error('[NativePush] Listener setup failed:', err);
      void logError({
        title: 'Native push listener setup failed',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack ?? null : null,
        severity: 'warning',
        source: 'client',
        context: {
          user_id: user.id,
          platform: Capacitor.getPlatform(),
        },
      });
    });

    return () => {
      cancelled = true;
      registrationListener?.remove();
      errorListener?.remove();
      appStateListener?.remove();
      clearRegistrationTimeout();
    };
  }, [clearRegistrationTimeout, saveNativeToken, startRegistrationTimeout, user?.id]);
}
