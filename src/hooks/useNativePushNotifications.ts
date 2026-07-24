import { useCallback, useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useAuth } from '@/context/AuthContext';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { logError } from '@/lib/errorLogger';

const NATIVE_PUSH_REGISTER_EVENT = 'flea-native-push-register';

export const requestNativePushRegistration = (reason = 'manual') => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NATIVE_PUSH_REGISTER_EVENT, { detail: { reason } }));
};

type NativePushEvent =
  | 'setup-started'
  | 'permission-checked'
  | 'permission-requested'
  | 'permission-not-granted'
  | 'registration-requested'
  | 'registration-callback-timeout'
  | 'token-received'
  | 'token-save-started'
  | 'token-save-succeeded'
  | 'cloud-token-verified'
  | 'cloud-token-missing-after-save';

const logNativePushState = (
  event: NativePushEvent,
  context: Record<string, unknown>,
  severity: 'warning' | 'error' = 'warning',
) => {
  if (severity === 'warning') return;
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

  const checkCloudTokenStatus = useCallback(async (reason: string) => {
    if (!user?.id) return { hasIosToken: false, checked: false };

    try {
      const { data, error } = await invokeCloudFunction('push-status', {
        method: 'GET',
        query: { reason },
      });

      if (error) {
        void logError({
          title: 'Native push token status check failed',
          message: error.message || 'push-status failed',
          severity: 'warning',
          source: 'client',
          context: { reason, user_id: user.id, platform: Capacitor.getPlatform() },
        });
        return { hasIosToken: false, checked: false };
      }

      return {
        hasIosToken: Boolean((data as { has_ios_token?: boolean } | null)?.has_ios_token),
        checked: true,
      };
    } catch (err) {
      void logError({
        title: 'Native push token status check crashed',
        message: err instanceof Error ? err.message : String(err),
        severity: 'warning',
        source: 'client',
        context: { reason, user_id: user.id, platform: Capacitor.getPlatform() },
      });
      return { hasIosToken: false, checked: false };
    }
  }, [user?.id]);

  const saveNativeToken = useCallback(async (apnsToken: string, reason: string) => {
    if (!user?.id || !apnsToken) return;

    if (saveInFlightRef.current) {
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
      try { localStorage.setItem('flea_native_push_endpoint', apnsToken); } catch {}
      console.log('[NativePush] APNs token saved');

      logNativePushState('token-save-succeeded', {
        reason,
        user_id: user.id,
        platform: Capacitor.getPlatform(),
        token_prefix: apnsToken.slice(0, 12),
      });

      const verified = await checkCloudTokenStatus(`${reason}-post-save`);
      logNativePushState(verified.hasIosToken ? 'cloud-token-verified' : 'cloud-token-missing-after-save', {
        reason,
        user_id: user.id,
        platform: Capacitor.getPlatform(),
        checked: verified.checked,
      }, verified.hasIosToken ? 'warning' : 'error');
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
  }, [checkCloudTokenStatus, user?.id]);

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
    let manualRegisterListener: ((event: Event) => void) | null = null;

    const registerNativePush = async (reason: string, opts?: { force?: boolean }) => {
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

        if (!opts?.force) {
          const cloudStatus = await checkCloudTokenStatus(reason);
          if (cloudStatus.checked && cloudStatus.hasIosToken) {
            console.log('[NativePush] Cloud iOS token already present:', reason);
            return;
          }
          // No token registered for the CURRENT user on the backend. Before
          // waiting on APNs (which may never re-fire the `registration`
          // callback if permission was granted in a previous session), try to
          // take over the cached device endpoint under this user id right
          // away. This is what stops account A's device from continuing to
          // receive account B's pushes after switching users.
          try {
            const cachedEndpoint = localStorage.getItem('flea_native_push_endpoint');
            if (cachedEndpoint && cloudStatus.checked && !cloudStatus.hasIosToken) {
              console.log('[NativePush] Reclaiming cached endpoint for current user:', reason);
              await invokeCloudFunction('register-push-subscription', {
                body: { endpoint: cachedEndpoint, platform: 'ios' },
              });
            }
          } catch (reclaimErr) {
            console.warn('[NativePush] Endpoint reclaim failed:', reclaimErr);
          }
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
    let actionListener: { remove: () => void } | null = null;

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

      // Tap-to-open: when the user taps a push in the tray (or a delivered
      // banner), route them to /notifications with query params so the Alerts
      // page can auto-open the right drawer/chat/listing for that alert.
      actionListener = await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action) => {
          try {
            const data = (action?.notification?.data ?? {}) as Record<string, unknown>;
            const params = new URLSearchParams();
            if (data.type) params.set('open', String(data.type));
            if (data.related_order_id) params.set('order', String(data.related_order_id));
            if (data.related_listing_id) params.set('listing', String(data.related_listing_id));
            if (data.related_thread_id) params.set('thread', String(data.related_thread_id));
            const url = params.toString() ? `/notifications?${params.toString()}` : '/notifications';
            window.dispatchEvent(new CustomEvent('flea-open-notification', { detail: url }));
          } catch (err) {
            console.warn('[NativePush] Failed to route tapped notification:', err);
          }
        },
      );

      if (cancelled) return;
      await registerNativePush('mount');

      appStateListener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          void registerNativePush('foreground');
        }
      });

      manualRegisterListener = (event: Event) => {
        const detail = (event as CustomEvent<{ reason?: string }>).detail;
        void registerNativePush(detail?.reason || 'manual-event', { force: true });
      };
      window.addEventListener(NATIVE_PUSH_REGISTER_EVENT, manualRegisterListener);
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
      if (manualRegisterListener) window.removeEventListener(NATIVE_PUSH_REGISTER_EVENT, manualRegisterListener);
      clearRegistrationTimeout();
    };
  }, [checkCloudTokenStatus, clearRegistrationTimeout, saveNativeToken, startRegistrationTimeout, user?.id]);
}
