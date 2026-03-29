import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

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
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    // Don't run in preview/iframe
    const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    const isPreview = window.location.hostname.includes('id-preview--') || window.location.hostname.includes('lovableproject.com');
    if (isInIframe || isPreview) return;

    try {
      // Register the push service worker
      const registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      // Check permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      // Subscribe to push
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const subJson = subscription.toJSON();
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) return;

      // Save to database (upsert by user_id + endpoint)
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,endpoint' }
      );

      if (error) {
        console.error('Failed to save push subscription:', error);
      } else {
        subscribedRef.current = true;
      }
    } catch (err) {
      console.error('Push subscription error:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    subscribe();
  }, [subscribe]);
}
