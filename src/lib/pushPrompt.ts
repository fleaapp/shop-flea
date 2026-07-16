import { Capacitor } from '@capacitor/core';

export type PushPromptSource = 'buyer_onboarding' | 'seller_verified' | 'passive';

const DISMISS_KEY = (userId: string) => `flea_push_prompt_dismissed_at_${userId}`;
const COUNT_KEY = (userId: string) => `flea_push_prompt_dismiss_count_${userId}`;

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_DISMISSALS = 3;

/** Best-effort check of current push permission state. */
export function getPushPermission(): 'default' | 'granted' | 'denied' | 'unsupported' {
  // On native iOS we cannot synchronously read the APNs permission, so treat
  // an unknown state as 'default' so we still surface the sheet.
  if (Capacitor.isNativePlatform()) {
    return 'default';
  }
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission as 'default' | 'granted' | 'denied';
}

export function shouldShowPushPrompt(userId: string | null | undefined, source: PushPromptSource): boolean {
  if (!userId) return false;
  const perm = getPushPermission();
  if (perm === 'granted' || perm === 'unsupported') return false;

  // Post-onboarding and post-verification always show once (permission still default).
  if (source === 'buyer_onboarding' || source === 'seller_verified') {
    return perm !== 'denied';
  }

  // Passive banner respects cooldown + max dismissals.
  try {
    const count = Number(localStorage.getItem(COUNT_KEY(userId)) || '0');
    if (count >= MAX_DISMISSALS) return false;
    const last = Number(localStorage.getItem(DISMISS_KEY(userId)) || '0');
    if (last && Date.now() - last < COOLDOWN_MS) return false;
  } catch {
    // ignore storage failures
  }
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
