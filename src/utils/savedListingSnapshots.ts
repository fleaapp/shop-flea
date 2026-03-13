export interface SavedListingSnapshot {
  listing: {
    id: string;
    user_id: string;
    title: string;
    description: string | null;
    brand: string;
    size: string;
    category: string;
    condition: string;
    colour: string | null;
    style: string | null;
    gender: string | null;
    price: number;
    shipping_price: number | null;
    images: string[];
    tags: string[] | null;
    status: string | null;
    created_at: string;
    updated_at: string;
    country_code: string | null;
    region_id: string | null;
  };
  seller: {
    user_id: string;
    username: string | null;
    avatar_url: string | null;
    location: string | null;
    rating: number | null;
    pause_selling: boolean | null;
    last_sign_in_at: string | null;
    status: string | null;
  } | null;
  saved_at: string;
}

const STORAGE_PREFIX = 'saved-listing-snapshots';

const storageKey = (userId: string) => `${STORAGE_PREFIX}:${userId}`;

const canUseStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

const parseSnapshots = (raw: string | null): Record<string, SavedListingSnapshot> => {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, SavedListingSnapshot>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const loadSavedListingSnapshots = (
  userId: string,
  listingIds?: string[],
): Map<string, SavedListingSnapshot> => {
  if (!userId || !canUseStorage()) return new Map<string, SavedListingSnapshot>();

  const allSnapshots = parseSnapshots(localStorage.getItem(storageKey(userId)));

  if (!listingIds || listingIds.length === 0) {
    return new Map(Object.entries(allSnapshots));
  }

  const filtered = new Map<string, SavedListingSnapshot>();
  for (const listingId of listingIds) {
    const snapshot = allSnapshots[listingId];
    if (snapshot) {
      filtered.set(listingId, snapshot);
    }
  }

  return filtered;
};

export const saveSavedListingSnapshots = (
  userId: string,
  snapshots: SavedListingSnapshot[],
): void => {
  if (!userId || snapshots.length === 0 || !canUseStorage()) return;

  const existing = parseSnapshots(localStorage.getItem(storageKey(userId)));

  for (const snapshot of snapshots) {
    if (!snapshot?.listing?.id) continue;
    existing[snapshot.listing.id] = {
      ...snapshot,
      saved_at: new Date().toISOString(),
    };
  }

  const entries = Object.entries(existing);
  // Keep storage bounded to avoid unbounded growth.
  const bounded = entries.slice(Math.max(entries.length - 800, 0));

  localStorage.setItem(storageKey(userId), JSON.stringify(Object.fromEntries(bounded)));
};
