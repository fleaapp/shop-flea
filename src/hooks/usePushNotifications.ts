import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const VAPID_PUBLIC_KEY = 'BOaAjWRbh4KQDJcS-Cx8XHtz7MFnI9RAfnXSW2U2J48f7gQiud-cFkT2jjSluV2tR_MQIDHYUPh-5AJucHLbmhA';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const subscribedRef = useRef(false);

  const subscribe = useCallback(async () => {
    if (!user?.id || subscribedRef.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[Push] Service worker or PushManager not available');
      return;
    }

    // Don't run in preview/iframe
    const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    const isEditorPreview = window.location.hostname.includes('id-preview--');
    if (isInIframe || isEditorPreview) {
      console.log('[Push] Skipping — iframe or editor preview');
      return;
    }

    try {
      // Register the push service worker
      console.log('[Push] Registering service worker...');
      const registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      console.log('[Push] Service worker ready');

      // Check permission
      const permission = await Notification.requestPermission();
      console.log('[Push] Permission:', permission);
      if (permission !== 'granted') return;

      // Always unsubscribe + resubscribe to get a fresh endpoint
      // iOS rotates push endpoints on PWA refresh, causing stale subscriptions
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        console.log('[Push] Unsubscribing old endpoint to force refresh...');
        await existingSub.unsubscribe();
      }

      console.log('[Push] Creating fresh subscription...');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
      console.log('[Push] Got subscription endpoint:', subscription.endpoint?.slice(0, 60));

      const subJson = subscription.toJSON();
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        console.error('[Push] Subscription missing required keys');
        return;
      }

      // Delete all old subscriptions for this user, then insert the fresh one
      // This ensures only the current endpoint is stored
      console.log('[Push] Replacing all subscriptions for user:', user.id);
      await (supabase as any).from('push_subscriptions').delete().eq('user_id', user.id);

      const { error } = await (supabase as any).from('push_subscriptions').insert({
        user_id: user.id,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error('[Push] Failed to save subscription:', JSON.stringify(error));
        toast.error(`Push save failed: ${error.message || error.code || 'Unknown error'}`);
      } else {
        console.log('[Push] Fresh subscription saved successfully!');
        subscribedRef.current = true;
      }
    } catch (err) {
      console.error('[Push] Subscription error:', err);
      toast.error(`Push error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [user?.id]);

  // Auto-subscribe on mount
  useEffect(() => {
    subscribe();
  }, [subscribe]);

  // Expose for manual trigger
  return { triggerSubscribe: () => { subscribedRef.current = false; subscribe(); } };
}
