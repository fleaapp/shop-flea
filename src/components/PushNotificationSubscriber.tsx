import { usePushNotifications } from '@/hooks/usePushNotifications';

export const PushNotificationSubscriber = () => {
  usePushNotifications();
  return null;
};
