import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface EngagementCounts {
  cart: number;
  wishlist: number;
}

const CACHE_TTL_MS = 60_000;
const BATCH_DELAY_MS = 60;
const MAX_BATCH = 100;

type CacheEntry = { counts: EngagementCounts; fetchedAt: number };

const cache = new Map<string, CacheEntry>();
const listeners = new Map<string, Set<(c: EngagementCounts) => void>>();

let pending = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const notify = (listingId: string, counts: EngagementCounts) => {
  cache.set(listingId, { counts, fetchedAt: Date.now() });
  listeners.get(listingId)?.forEach((cb) => cb(counts));
};

const flush = async () => {
  flushTimer = null;
  const ids = Array.from(pending).slice(0, MAX_BATCH);
  const overflow = Array.from(pending).slice(MAX_BATCH);
  pending = new Set(overflow);
  if (overflow.length > 0) schedule();
  if (ids.length === 0) return;

  try {
    const { data, error } = await supabase.rpc('get_listing_engagement_counts', {
      _listing_ids: ids,
    });
    if (error || !data) return;

    const seen = new Set<string>();
    for (const row of data as Array<{ listing_id: string; cart_count: number; wishlist_count: number }>) {
      seen.add(row.listing_id);
      notify(row.listing_id, {
        cart: Number(row.cart_count) || 0,
        wishlist: Number(row.wishlist_count) || 0,
      });
    }
    // Cache zeros for ids the RPC didn't return so we don't refetch in a loop.
    for (const id of ids) {
      if (!seen.has(id)) notify(id, { cart: 0, wishlist: 0 });
    }
  } catch {
    // Silent - badges are decorative.
  }
};

const schedule = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(() => void flush(), BATCH_DELAY_MS);
};

/** Invalidate cached counts so the next mount refetches (e.g. after add/remove). */
export const invalidateEngagementCounts = (listingId?: string) => {
  if (listingId) cache.delete(listingId);
  else cache.clear();
};

/**
 * Returns the number of people who have this listing in their cart / wishlist.
 * Requests from every card on screen are coalesced into a single RPC call.
 */
export const useListingEngagementCounts = (listingId?: string | null): EngagementCounts => {
  const [counts, setCounts] = useState<EngagementCounts>(() => {
    if (!listingId) return { cart: 0, wishlist: 0 };
    return cache.get(listingId)?.counts ?? { cart: 0, wishlist: 0 };
  });

  useEffect(() => {
    if (!listingId) {
      setCounts({ cart: 0, wishlist: 0 });
      return;
    }

    const cached = cache.get(listingId);
    if (cached) setCounts(cached.counts);

    let set = listeners.get(listingId);
    if (!set) {
      set = new Set();
      listeners.set(listingId, set);
    }
    const cb = (c: EngagementCounts) => setCounts(c);
    set.add(cb);

    const isFresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;
    if (!isFresh) {
      pending.add(listingId);
      schedule();
    }

    return () => {
      set?.delete(cb);
      if (set && set.size === 0) listeners.delete(listingId);
    };
  }, [listingId]);

  return counts;
};

export default useListingEngagementCounts;
