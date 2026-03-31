const CLOUD_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const CLOUD_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export async function sendPushNotification(
  userId: string,
  notification: {
    type: string;
    title: string;
    message: string;
    related_listing_id?: string;
    related_order_id?: string;
    related_thread_id?: string;
  }
) {
  try {
    const url = `https://${CLOUD_PROJECT_ID}.supabase.co/functions/v1/send-push-notification`;
    console.log('[Push] Calling:', url, 'for user:', userId, 'type:', notification.type);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUD_ANON_KEY}`,
      },
      body: JSON.stringify({ user_id: userId, notification }),
    });
    const data = await res.json().catch(() => null);
    console.log('[Push] Response:', res.status, data);
    if (!res.ok) {
      console.error('[Push] Failed:', res.status, data);
    }
  } catch (err) {
    console.error('[Push] Failed to send push notification:', err);
  }
}
