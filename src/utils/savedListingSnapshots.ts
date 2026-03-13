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
