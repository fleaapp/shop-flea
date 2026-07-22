export type BundleShippingMode = 'none' | 'discounted' | 'free';

export type LocalShippingPrefs = {
  mode: BundleShippingMode;
  discountPercent: number | null;
  updatedAt: number;
};

export type LocalShippingPrefsInput = {
  mode: BundleShippingMode;
  discountPercent: number | null;
};

const keyForUser = (userId: string) => `flea_shipping_prefs_${userId}`;

export function loadShippingPrefs(userId: string): LocalShippingPrefs | null {
  try {
    const raw = localStorage.getItem(keyForUser(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    // New shape
    if (typeof parsed.mode === 'string' && ['none', 'discounted', 'free'].includes(parsed.mode)) {
      return {
        mode: parsed.mode,
        discountPercent:
          typeof parsed.discountPercent === 'number' ? parsed.discountPercent : null,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
      };
    }

    // Legacy fallback: previous tiered shape -> map to 'none'.
    if (typeof parsed.tieredEnabled === 'boolean') {
      return {
        mode: 'none',
        discountPercent: null,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function saveShippingPrefs(userId: string, prefs: LocalShippingPrefsInput) {
  const record: LocalShippingPrefs = {
    mode: prefs.mode,
    discountPercent: prefs.mode === 'discounted' ? prefs.discountPercent : null,
    updatedAt: Date.now(),
  };
  localStorage.setItem(keyForUser(userId), JSON.stringify(record));
}
