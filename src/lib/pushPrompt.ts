import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export type PushPromptSource = 'buyer_onboarding' | 'seller_verified' | 'passive';

const DISMISS_KEY = (userId: string) => `flea_push_prompt_dismissed_at_${userId}`;
const COUNT_KEY = (userId: string) => `flea_push_prompt_dismiss_count_${userId}`;

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_DISMISSALS = 3;

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

/** Best-effort synchronous check. On native returns 'default' (unknown). */
export function getPushPermission(): PushPermissionState {
  if (Capacitor.isNativePlatform()) {
    return 'default';
  }
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission as 'default' | 'granted' | 'denied';
}

/** Native-aware permission check. Uses APNs/FCM state on native. */
export async function getPushPermissionAsync(): Promise<PushPermissionState> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await PushNotifications.checkPermissions();
      if (res.receive === 'granted') return 'granted';
      if (res.receive === 'denied') return 'denied';
      return 'default';
    } catch {
      return 'default';
    }
  }
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission as 'default' | 'granted' | 'denied';
}

export async function hasNativeCloudPushToken(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { invokeCloudFunction } = await import('@/utils/cloudFunctions');
    const { data, error } = await invokeCloudFunction('push-status', { method: 'GET' });
    if (error) return false;
    return Boolean((data as { has_ios_token?: boolean } | null)?.has_ios_token);
  } catch {
    return false;
  }
}

function passesCooldown(userId: string): boolean {
  try {
    const count = Number(localStorage.getItem(COUNT_KEY(userId)) || '0');
    if (count >= MAX_DISMISSALS) return false;
    const last = Number(localStorage.getItem(DISMISS_KEY(userId)) || '0');
    if (last && Date.now() - last < COOLDOWN_MS) return false;
  } catch {
    // ignore storage failures
  }
  return true;
}

export function shouldShowPushPrompt(userId: string | null | undefined, source: PushPromptSource): boolean {
  if (!userId) return false;
  const perm = getPushPermission();
  if (perm === 'granted' || perm === 'unsupported') return false;

  if (source === 'buyer_onboarding' || source === 'seller_verified') {
    return perm !== 'denied';
  }
  if (!passesCooldown(userId)) return false;
  return perm === 'default';
}

/** Async, native-aware version — use when the real APNs/FCM state matters. */
export async function shouldShowPushPromptAsync(
  userId: string | null | undefined,
  source: PushPromptSource,
): Promise<boolean> {
  if (!userId) return false;
  const perm = await getPushPermissionAsync();
  if (perm === 'granted' || perm === 'unsupported') return false;

  if (source === 'buyer_onboarding' || source === 'seller_verified') {
    return perm !== 'denied';
  }
  if (!passesCooldown(userId)) return false;
  return perm === 'default';
}


export function recordPushPromptDismissed(userId: string | null | undefined) {
  if (!userId) return;
  try {
    localStorage.setItem(DISMISS_KEY(userId), String(Date.now()));
    const count = Number(localStorage.getItem(COUNT_KEY(userId)) || '0') + 1;
    localStorage.setItem(COUNT_KEY(userId), String(count));
  } catch {
    // ignore
  }
}

export const pushPromptCopy: Record<PushPromptSource, { title: string; body: string }> = {
  buyer_onboarding: {
    title: 'Turn on notifications',
    body: "Get notified when items you love drop in price, sell out, or when a seller replies.",
  },
  seller_verified: {
    title: 'Stay on top of your sales',
    body: "We'll ping you the moment you make a sale, get a message, or receive a review.",
  },
  passive: {
    title: 'Turn on notifications',
    body: 'Never miss a sale, message, or price drop. You can turn these off any time.',
  },
};
