import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { preloadImages } from '@/utils/preloadAssets';
import { fetchSellerProfiles } from '@/utils/fetchSellerProfiles';
import { getInvalidListingIds } from '@/utils/listingAccess';
import { subscribeListingInvalidated } from '@/utils/listingInvalidation';
import type { DbListing } from '@/hooks/useListings';

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
export const useHomeFeed = () => {
  const { user, profile } = useAuth();
  const [listings, setListings] = useState<DbListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

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
          .select('*')
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

      // Validate access (same hygiene as useListings).
      const invalid = await getInvalidListingIds(rows.map((l) => l.id));
      const validated = invalid.size > 0 ? rows.filter((l) => !invalid.has(l.id)) : rows;

      // Hydrate seller profiles.
      const userIds = [...new Set(validated.map((l) => l.user_id))];
      const { profiles, canTrustMissing } = await fetchSellerProfiles(userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      const withProfiles = validated
        .filter((l) => {
          const p = profileMap.get(l.user_id);
          if (p?.status === 'blocked') return false;
          if (canTrustMissing && !p) return false;
          if (p?.pause_selling) return false;
          return true;
        })
        .map((l) => ({ ...l, profiles: profileMap.get(l.user_id) || null }));

      if (mode === 'reset') {
        const urls = withProfiles
          .slice(0, 3)
          .flatMap((l) => l.images?.slice(0, 1) || [])
          .filter(Boolean);
        if (urls.length > 0) preloadImages(urls);
        setListings(withProfiles);
        setOffset(rows.length);
      } else {
        setListings((prev) => {
          const seen = new Set(prev.map((l) => l.id));
          const merged = [...prev];
          for (const l of withProfiles) if (!seen.has(l.id)) merged.push(l);
          return merged;
        });
        setOffset(useOffset + rows.length);
      }

      setLoading(false);
      setLoadingMore(false);
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
