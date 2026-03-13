import type { Listing } from '@/types/listing';

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

type SnapshotSeller = NonNullable<SavedListingSnapshot['seller']>;

export const createSavedListingSnapshotFromListing = (
  listing: Listing,
  seller?: Partial<SnapshotSeller> | null,
): SavedListingSnapshot => {
  const nowIso = new Date().toISOString();
  const createdAt = listing.createdAt instanceof Date
    ? listing.createdAt.toISOString()
    : nowIso;

  return {
    listing: {
      id: listing.id,
      user_id: listing.sellerId,
      title: listing.title,
      description: listing.description || null,
      brand: listing.brand,
      size: listing.size,
      category: listing.category,
      condition: listing.condition,
      colour: null,
      style: null,
      gender: null,
      price: Number(listing.price || 0),
      shipping_price: Number(listing.shippingPrice || 0),
      images: listing.images && listing.images.length > 0
        ? listing.images
        : (listing.image ? [listing.image] : []),
      tags: listing.tags || [],
      status: listing.status || 'active',
      created_at: createdAt,
      updated_at: nowIso,
      country_code: null,
      region_id: null,
    },
    seller: {
      user_id: seller?.user_id || listing.sellerId,
      username: seller?.username ?? listing.sellerName ?? null,
      avatar_url: seller?.avatar_url ?? listing.sellerAvatar ?? null,
      location: seller?.location ?? listing.location ?? null,
      rating: typeof seller?.rating === 'number' ? seller.rating : null,
      pause_selling: typeof seller?.pause_selling === 'boolean' ? seller.pause_selling : null,
      last_sign_in_at: typeof seller?.last_sign_in_at === 'string' ? seller.last_sign_in_at : null,
      status: typeof seller?.status === 'string' ? seller.status : null,
    },
    saved_at: nowIso,
  };
};

const STORAGE_PREFIX = 'saved-listing-snapshots';
const GLOBAL_STORAGE_SUFFIX = 'global';
const MAX_SNAPSHOTS_PER_BUCKET = 800;

const storageKey = (userId: string) => `${STORAGE_PREFIX}:${userId}`;
const globalStorageKey = () => `${STORAGE_PREFIX}:${GLOBAL_STORAGE_SUFFIX}`;

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

const snapshotTimestamp = (snapshot: SavedListingSnapshot | undefined): number => {
  if (!snapshot?.saved_at) return 0;
  const timestamp = Date.parse(snapshot.saved_at);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const shouldReplaceSnapshot = (
  previous: SavedListingSnapshot | undefined,
  next: SavedListingSnapshot,
): boolean => {
  if (!previous) return true;
  return snapshotTimestamp(next) >= snapshotTimestamp(previous);
};

const boundedSnapshots = (
  snapshots: Record<string, SavedListingSnapshot>,
): Record<string, SavedListingSnapshot> => {
  const entries = Object.entries(snapshots)
    .sort(([, a], [, b]) => snapshotTimestamp(a) - snapshotTimestamp(b));

  const bounded = entries.slice(Math.max(entries.length - MAX_SNAPSHOTS_PER_BUCKET, 0));
  return Object.fromEntries(bounded);
};

const writeSnapshots = (key: string, snapshots: Record<string, SavedListingSnapshot>) => {
  if (!canUseStorage()) return;

  try {
    localStorage.setItem(key, JSON.stringify(boundedSnapshots(snapshots)));
  } catch (error) {
    console.warn('Failed to persist saved listing snapshots:', error);
  }
};

const listSnapshotKeys = (): string[] => {
  if (!canUseStorage()) return [];

  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith(`${STORAGE_PREFIX}:`)) {
      keys.push(key);
    }
  }
  return keys;
};

const mergeSnapshotRecords = (
  ...records: Array<Record<string, SavedListingSnapshot>>
): Record<string, SavedListingSnapshot> => {
  const merged: Record<string, SavedListingSnapshot> = {};

  for (const record of records) {
    for (const [listingId, snapshot] of Object.entries(record)) {
      if (shouldReplaceSnapshot(merged[listingId], snapshot)) {
        merged[listingId] = snapshot;
      }
    }
  }

  return merged;
};

const toSnapshotMap = (
  allSnapshots: Record<string, SavedListingSnapshot>,
  listingIds?: string[],
): Map<string, SavedListingSnapshot> => {
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

const upsertSnapshotsIntoStore = (
  key: string,
  snapshots: SavedListingSnapshot[],
): void => {
  if (!canUseStorage()) return;

  const existing = parseSnapshots(localStorage.getItem(key));

  for (const snapshot of snapshots) {
    if (!snapshot?.listing?.id) continue;

    existing[snapshot.listing.id] = {
      ...snapshot,
      saved_at: new Date().toISOString(),
    };
  }

  writeSnapshots(key, existing);
};

export const loadSavedListingSnapshots = (
  userId: string,
  listingIds?: string[],
): Map<string, SavedListingSnapshot> => {
  if (!userId || !canUseStorage()) return new Map<string, SavedListingSnapshot>();

  const userKey = storageKey(userId);
  const userSnapshots = parseSnapshots(localStorage.getItem(userKey));
  const globalSnapshots = parseSnapshots(localStorage.getItem(globalStorageKey()));

  let mergedSnapshots = mergeSnapshotRecords(userSnapshots, globalSnapshots);
  const missingListingIds = (listingIds ?? []).filter((listingId) => !mergedSnapshots[listingId]);

  if (missingListingIds.length > 0 || Object.keys(mergedSnapshots).length === 0) {
    const fallbackKeys = listSnapshotKeys().filter(
      (key) => key !== userKey && key !== globalStorageKey(),
    );

    for (const key of fallbackKeys) {
      const fallbackSnapshots = parseSnapshots(localStorage.getItem(key));
      mergedSnapshots = mergeSnapshotRecords(mergedSnapshots, fallbackSnapshots);

      if (listingIds && listingIds.every((listingId) => !!mergedSnapshots[listingId])) {
        break;
      }
    }
  }

  // Self-heal current user scope with recovered snapshots from global/legacy keys.
  if (listingIds && listingIds.length > 0) {
    const recovered: Record<string, SavedListingSnapshot> = {};

    for (const listingId of listingIds) {
      if (!userSnapshots[listingId] && mergedSnapshots[listingId]) {
        recovered[listingId] = mergedSnapshots[listingId];
      }
    }

    if (Object.keys(recovered).length > 0) {
      writeSnapshots(userKey, { ...userSnapshots, ...recovered });
    }
  }

  return toSnapshotMap(mergedSnapshots, listingIds);
};

export const loadSavedListingSnapshot = (
  userId: string,
  listingId: string,
): SavedListingSnapshot | null => {
  if (!listingId) return null;

  return loadSavedListingSnapshots(userId, [listingId]).get(listingId) ?? null;
};

export const saveSavedListingSnapshots = (
  userId: string,
  snapshots: SavedListingSnapshot[],
): void => {
  if (!userId || snapshots.length === 0 || !canUseStorage()) return;

  upsertSnapshotsIntoStore(storageKey(userId), snapshots);
  upsertSnapshotsIntoStore(globalStorageKey(), snapshots);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toSnapshot = (value: unknown): SavedListingSnapshot | null => {
  if (!isRecord(value)) return null;

  const listing = value.listing;
  if (!isRecord(listing) || typeof listing.id !== 'string' || typeof listing.user_id !== 'string') {
    return null;
  }

  const seller = isRecord(value.seller)
    ? {
        user_id: typeof value.seller.user_id === 'string' ? value.seller.user_id : '',
        username: typeof value.seller.username === 'string' ? value.seller.username : null,
        avatar_url: typeof value.seller.avatar_url === 'string' ? value.seller.avatar_url : null,
        location: typeof value.seller.location === 'string' ? value.seller.location : null,
        rating: typeof value.seller.rating === 'number' ? value.seller.rating : null,
        pause_selling: typeof value.seller.pause_selling === 'boolean' ? value.seller.pause_selling : null,
        last_sign_in_at: typeof value.seller.last_sign_in_at === 'string' ? value.seller.last_sign_in_at : null,
        status: typeof value.seller.status === 'string' ? value.seller.status : null,
      }
    : null;

  return {
    listing: {
      id: listing.id,
      user_id: listing.user_id,
      title: typeof listing.title === 'string' ? listing.title : '',
      description: typeof listing.description === 'string' ? listing.description : null,
      brand: typeof listing.brand === 'string' ? listing.brand : '',
      size: typeof listing.size === 'string' ? listing.size : '',
      category: typeof listing.category === 'string' ? listing.category : '',
      condition: typeof listing.condition === 'string' ? listing.condition : 'good',
      colour: typeof listing.colour === 'string' ? listing.colour : null,
      style: typeof listing.style === 'string' ? listing.style : null,
      gender: typeof listing.gender === 'string' ? listing.gender : null,
      price: typeof listing.price === 'number' ? listing.price : 0,
      shipping_price: typeof listing.shipping_price === 'number' ? listing.shipping_price : 0,
      images: Array.isArray(listing.images)
        ? listing.images.filter((img): img is string => typeof img === 'string')
        : [],
      tags: Array.isArray(listing.tags)
        ? listing.tags.filter((tag): tag is string => typeof tag === 'string')
        : [],
      status: typeof listing.status === 'string' ? listing.status : null,
      created_at: typeof listing.created_at === 'string' ? listing.created_at : new Date().toISOString(),
      updated_at: typeof listing.updated_at === 'string' ? listing.updated_at : new Date().toISOString(),
      country_code: typeof listing.country_code === 'string' ? listing.country_code : null,
      region_id: typeof listing.region_id === 'string' ? listing.region_id : null,
    },
    seller,
    saved_at: typeof value.saved_at === 'string' ? value.saved_at : new Date().toISOString(),
  };
};

export const extractSavedListingSnapshots = (raw: unknown): SavedListingSnapshot[] => {
  if (!isRecord(raw)) return [];

  return Object.values(raw)
    .map(toSnapshot)
    .filter((snapshot): snapshot is SavedListingSnapshot => !!snapshot);
};
