import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// Cache for paused seller IDs to avoid repeated queries
const pausedSellersCache = new Map<string, boolean>();
// Freshness is tracked per seller so looking up one seller never extends
// another seller's stale value.
const fetchedAt = new Map<string, number>();
const CACHE_TTL = 30000; // 30 seconds
const isFresh = (id: string) =>
  pausedSellersCache.has(id) && Date.now() - (fetchedAt.get(id) ?? 0) < CACHE_TTL;

/** Drop a seller's cached paused state (e.g. right after they toggle pause). */
export const invalidatePausedSeller = (sellerId: string) => {
  pausedSellersCache.delete(sellerId);
  fetchedAt.delete(sellerId);
};

export const usePausedSellers = (sellerIds: string[]) => {
  const [pausedSellerIds, setPausedSellerIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchPausedStatus = useCallback(async () => {
    if (sellerIds.length === 0) {
      setPausedSellerIds(new Set());
      setLoading(false);
      return;
    }

    const needsFetch = sellerIds.filter(id => !isFresh(id));

    // If all are cached, use cache
    if (needsFetch.length === 0) {
      const paused = new Set(sellerIds.filter(id => pausedSellersCache.get(id)));
      setPausedSellerIds(paused);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('profiles_public')
      .select('user_id, pause_selling')
      .in('user_id', sellerIds);

    if (!error && data) {
      // Update cache
      const t = Date.now();
      data.forEach(profile => {
        pausedSellersCache.set(profile.user_id, profile.pause_selling);
        fetchedAt.set(profile.user_id, t);
      });

      const paused = new Set(data.filter(p => p.pause_selling).map(p => p.user_id));
      setPausedSellerIds(paused);
    }
    setLoading(false);
  }, [sellerIds.join(',')]);

  useEffect(() => {
    fetchPausedStatus();
  }, [fetchPausedStatus]);

  const isSellerPaused = useCallback((sellerId: string) => {
    return pausedSellerIds.has(sellerId);
  }, [pausedSellerIds]);

  return { pausedSellerIds, isSellerPaused, loading, refetch: fetchPausedStatus };
};

// Single seller check hook
export const useIsSellerPaused = (sellerId: string | undefined) => {
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) {
      setIsPaused(false);
      setLoading(false);
      return;
    }

    const checkPauseStatus = async () => {
      // Check cache first
      if (isFresh(sellerId)) {
        setIsPaused(pausedSellersCache.get(sellerId) || false);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('profiles_public')
        .select('pause_selling')
        .eq('user_id', sellerId)
        .maybeSingle();

      if (!error && data) {
        pausedSellersCache.set(sellerId, data.pause_selling);
        fetchedAt.set(sellerId, Date.now());
        setIsPaused(data.pause_selling);
      }
      setLoading(false);
    };

    checkPauseStatus();
  }, [sellerId]);

  return { isPaused, loading };
};
