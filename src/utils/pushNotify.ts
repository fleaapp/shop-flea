import { invokeCloudFunction } from '@/utils/cloudFunctions';

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
    await invokeCloudFunction('send-push-notification', {
      user_id: userId,
      notification,
    });
  } catch (err) {
    console.error('[Push] Failed to send push notification:', err);
  }
}
