export type LocalShippingPrefs =
  | {
      tieredEnabled: true;
      tier1: number;
      tier2: number;
      tier3: number;
      updatedAt: number;
    }
  | {
      tieredEnabled: false;
      updatedAt: number;
    };

export type LocalShippingPrefsInput =
  | {
      tieredEnabled: true;
      tier1: number;
      tier2: number;
      tier3: number;
    }
  | {
      tieredEnabled: false;
    };

const keyForUser = (userId: string) => `flea_shipping_prefs_${userId}`;

export function loadShippingPrefs(userId: string): LocalShippingPrefs | null {
  try {
    const raw = localStorage.getItem(keyForUser(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.updatedAt !== 'number') return null;
    if (typeof parsed.tieredEnabled !== 'boolean') return null;

    if (parsed.tieredEnabled === false) {
      return { tieredEnabled: false, updatedAt: parsed.updatedAt };
    }

    if (
      typeof parsed.tier1 !== 'number' ||
      typeof parsed.tier2 !== 'number' ||
      typeof parsed.tier3 !== 'number'
    ) {
      return null;
    }

    return {
      tieredEnabled: true,
      tier1: parsed.tier1,
      tier2: parsed.tier2,
      tier3: parsed.tier3,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function saveShippingPrefs(userId: string, prefs: LocalShippingPrefsInput) {
  const record: LocalShippingPrefs = {
    ...(prefs as any),
    updatedAt: Date.now(),
  };
  localStorage.setItem(keyForUser(userId), JSON.stringify(record));
}
