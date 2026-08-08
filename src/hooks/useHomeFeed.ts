import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { preloadImages } from '@/utils/preloadAssets';
import { fetchSellerProfiles } from '@/utils/fetchSellerProfiles';
import { subscribeListingInvalidated } from '@/utils/listingInvalidation';
import type { DbListing } from '@/hooks/useListings';
import { LISTING_CARD_COLUMNS } from '@/lib/listingColumns';

const PAGE_SIZE = 50;

/**
 * Personalised home feed.
 *
 * Calls the `get_home_feed` Postgres RPC which uses ONLY the user's existing
 * cart_items and favorites as recommendation signals (cart = 5 points,
 * wishlist = 3 points). The RPC interleaves 70% personalised picks with
 * 30% fresh/trending listings, and falls back to fresh/trending for users
 * with no cart or wishlist activity.
 *
 * No new tracking tables, no impressions, no event writes.
 *
 * Returns the same shape as useListings so it's a drop-in replacement for the
 * unfiltered home swipe stack.
 */
// Session-scoped deck cache. Opening a listing unmounts Index (separate
// route), so without this the RPC re-runs on return and re-shuffles the deck,
// dumping the user back at the top of the stack. Caching the ordered rows lets
// the stack resume exactly where the user left off; actioned listings are
// filtered out by Index, so the next card shows immediately.
type FeedCache = { userId: string | null; listings: DbListing[]; offset: number; hasMore: boolean };
let feedCache: FeedCache | null = null;

export const useHomeFeed = () => {
  const { user, profile } = useAuth();
  const cachedForUser = feedCache && feedCache.userId === (user?.id ?? null) ? feedCache : null;
  const [listings, setListings] = useState<DbListing[]>(cachedForUser?.listings ?? []);
  const [loading, setLoading] = useState(!cachedForUser);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(cachedForUser?.hasMore ?? true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(cachedForUser?.offset ?? 0);

  // Keep the module cache in sync with the live deck.
  useEffect(() => {
    feedCache = { userId: user?.id ?? null, listings, offset, hasMore };
  }, [user?.id, listings, offset, hasMore]);


  const fetchPage = useCallback(
    async (mode: 'reset' | 'append', offsetOverride?: number) => {
      if (mode === 'reset') setLoading(true);
      else setLoadingMore(true);
      setError(null);

      const useOffset = mode === 'append' ? (offsetOverride ?? 0) : 0;

      const { data, error: rpcError } = await supabase.rpc('get_home_feed', {
        p_limit: PAGE_SIZE,
        p_offset: useOffset,
      });

      let rows = (data || []) as DbListing[];

      if (rpcError) {
        const functionMissing = rpcError.code === 'PGRST202' || /could not find the function/i.test(rpcError.message || '');

        if (!functionMissing) {
          setError(rpcError.message);
          if (mode === 'reset') setListings([]);
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        const regionId = profile?.region_id || 'AU';
        let fallbackQuery = supabase
          .from('listings')
          .select(LISTING_CARD_COLUMNS)
          .eq('status', 'active')
          .or(`region_id.is.null,region_id.eq.${regionId}`)
          .order('created_at', { ascending: false })
          .range(useOffset, useOffset + PAGE_SIZE - 1);

        if (user?.id) fallbackQuery = fallbackQuery.neq('user_id', user.id);

        const { data: fallbackData, error: fallbackError } = await fallbackQuery;

        if (fallbackError) {
          setError(fallbackError.message);
          if (mode === 'reset') setListings([]);
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        rows = (fallbackData || []) as DbListing[];
      }
      setHasMore(rows.length === PAGE_SIZE);

      if (rows.length === 0) {
        if (mode === 'reset') setListings([]);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      // Paint cards immediately using the RPC's results; the RPC already
      // filters blocked/paused sellers, discarded listings and non-active
      // statuses, so we don't need to gate first paint on an edge-function
      // hop or a second seller-profile query. Preload the very first image
      // with high priority so the top card appears in the same frame.
      const initialRows = rows.map((l) => ({ ...l, profiles: null as DbListing['profiles'] }));

      const firstImage = initialRows[0]?.images?.[0];
      if (firstImage) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = firstImage;
        (link as HTMLLinkElement & { fetchPriority?: string }).fetchPriority = 'high';
        document.head.appendChild(link);
      }
      const preloadUrls = initialRows
        .slice(0, 5)
        .flatMap((l) => l.images?.slice(0, 1) || [])
        .filter(Boolean);
      if (preloadUrls.length > 0) preloadImages(preloadUrls);

      if (mode === 'reset') {
        setListings(initialRows);
        setOffset(rows.length);
      } else {
        setListings((prev) => {
          const seen = new Set(prev.map((l) => l.id));
          const merged = [...prev];
          for (const l of initialRows) if (!seen.has(l.id)) merged.push(l);
          return merged;
        });
        setOffset(useOffset + rows.length);
      }

      setLoading(false);
      setLoadingMore(false);

      // Hydrate seller profiles in the background and merge them in.
      // Any listing whose seller has just been blocked / paused since the
      // RPC ran gets removed here.
      const userIds = [...new Set(rows.map((l) => l.user_id))];
      void fetchSellerProfiles(userIds).then(({ profiles, canTrustMissing }) => {
        const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
        setListings((prev) =>
          prev
            .filter((l) => {
              const p = profileMap.get(l.user_id);
              if (p?.status === 'blocked') return false;
              if (canTrustMissing && !p) return false;
              if (p?.pause_selling) return false;
              return true;
            })
            .map((l) => ({ ...l, profiles: profileMap.get(l.user_id) || l.profiles || null })),
        );
      }).catch((err) => {
        console.warn('fetchSellerProfiles failed (feed already shown):', err);
      });
    },
    [profile?.region_id, user?.id],
  );

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchPage('reset');
  }, [user, fetchPage]);

  // Drop any listing that the global realtime channel reports as deleted /
  // removed / archived / blocked / sold so the swipe stack updates instantly
  // across every open client.
  useEffect(() => {
    return subscribeListingInvalidated(({ id }) => {
      setListings((prev) => prev.filter((l) => l.id !== id));
    });
  }, []);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    fetchPage('append', offset);
  }, [loading, loadingMore, hasMore, offset, fetchPage]);

  return {
    listings,
    loading,
    loadingMore,
    hasMore,
    error,
    refetch: () => fetchPage('reset'),
    loadMore,
  };
};
