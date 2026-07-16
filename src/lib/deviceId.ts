// Stable device identifier helper. Uses Capacitor on native for a real
// per-device id; falls back to a persistent random id in localStorage on web.

import { Capacitor } from "@capacitor/core";

const WEB_KEY = "flea_web_device_id";

let cached: string | null = null;

export async function getDeviceId(): Promise<string | null> {
  if (cached) return cached;

  try {
    if (Capacitor.isNativePlatform()) {
      const { Device } = await import("@capacitor/device");
      const info = await Device.getId();
      const id = (info as any)?.identifier ?? (info as any)?.uuid ?? null;
      if (id) {
        cached = String(id);
        return cached;
      }
    }
  } catch (e) {
    console.warn("[deviceId] native lookup failed", e);
  }

  try {
    const existing = localStorage.getItem(WEB_KEY);
    if (existing) {
      cached = existing;
      return cached;
    }
    const generated = `web_${crypto.randomUUID()}`;
    localStorage.setItem(WEB_KEY, generated);
    cached = generated;
    return cached;
  } catch {
    return null;
  }
}
