// Persistent auth storage adapter.
// On native (Capacitor iOS/Android) we use @capacitor/preferences which is
// backed by iOS Keychain-adjacent NSUserDefaults / Android SharedPreferences.
// WKWebView localStorage can be evicted by iOS when the device is low on
// storage or after long backgrounding, which was silently logging users out.
// Preferences persists across app launches and OS storage pressure.
// We mirror writes to localStorage so synchronous reads elsewhere still work.

import { Preferences } from "@capacitor/preferences";

function isNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return !!cap?.isNativePlatform?.();
}

const native = isNative();

export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (native) {
      try {
        const { value } = await Preferences.get({ key });
        if (value != null) {
          try { localStorage.setItem(key, value); } catch {}
          return value;
        }
      } catch (e) {
        console.warn("[authStorage] Preferences.get failed", e);
      }
    }
    try {
      const v = localStorage.getItem(key);
      // Backfill Preferences if we found a value only in localStorage (e.g.
      // first launch after upgrading to the Preferences-backed adapter).
      if (native && v != null) {
        Preferences.set({ key, value: v }).catch(() => {});
      }
      return v;
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try { localStorage.setItem(key, value); } catch {}
    if (native) {
      try {
        await Preferences.set({ key, value });
      } catch (e) {
        console.warn("[authStorage] Preferences.set failed", e);
      }
    }
  },
  async removeItem(key: string): Promise<void> {
    try { localStorage.removeItem(key); } catch {}
    if (native) {
      try {
        await Preferences.remove({ key });
      } catch (e) {
        console.warn("[authStorage] Preferences.remove failed", e);
      }
    }
  },
};
