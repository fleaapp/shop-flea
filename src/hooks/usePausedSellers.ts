import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// Cache for paused seller IDs to avoid repeated queries
const pausedSellersCache = new Map<string, boolean>();
let lastFetchTime = 0;
const CACHE_TTL = 30000; // 30 seconds

export const usePausedSellers = (sellerIds: string[]) => {
  const [pausedSellerIds, setPausedSellerIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchPausedStatus = useCallback(async () => {
    if (sellerIds.length === 0) {
      setPausedSellerIds(new Set());
      setLoading(false);
      return;
    }

    const now = Date.now();
    const needsFetch = sellerIds.filter(id => {
      // Check if we have a cached value and it's still valid
      if (pausedSellersCache.has(id) && now - lastFetchTime < CACHE_TTL) {
        return false;
      }
      return true;
    });

    // If all are cached, use cache
    if (needsFetch.length === 0) {
      const paused = new Set(sellerIds.filter(id => pausedSellersCache.get(id)));
      setPausedSellerIds(paused);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, pause_selling')
      .in('user_id', sellerIds);

    if (!error && data) {
      // Update cache
      data.forEach(profile => {
        pausedSellersCache.set(profile.user_id, profile.pause_selling);
      });
      lastFetchTime = Date.now();

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
      if (pausedSellersCache.has(sellerId) && Date.now() - lastFetchTime < CACHE_TTL) {
        setIsPaused(pausedSellersCache.get(sellerId) || false);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('pause_selling')
        .eq('user_id', sellerId)
        .maybeSingle();

      if (!error && data) {
        pausedSellersCache.set(sellerId, data.pause_selling);
        lastFetchTime = Date.now();
        setIsPaused(data.pause_selling);
      }
      setLoading(false);
    };

    checkPauseStatus();
  }, [sellerId]);

  return { isPaused, loading };
};
