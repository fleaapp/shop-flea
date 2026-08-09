import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  addGuestDiscard,
  removeGuestDiscard,
  getGuestDiscards,
} from '@/utils/guestDiscards';
import { getActionedIds, setActionedIds } from '@/utils/actionedListingCache';

export const useDiscardedListings = () => {
  const { user } = useAuth();
  // Seed from the user-scoped cache so the swipe deck never re-shows a passed
  // listing while the fetch is in flight after a remount.
  const [discardedIds, setDiscardedIdsState] = useState<Set<string>>(() =>
    user ? getActionedIds('discarded', user.id) : new Set(getGuestDiscards()),
  );
  const [loading, setLoading] = useState(false);

  const setDiscardedIds = useCallback(
    (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setDiscardedIdsState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        setActionedIds('discarded', user?.id ?? null, next);
        return next;
      });
    },
    [user?.id],
  );

  useEffect(() => {
    if (user) {
      setDiscardedIdsState(getActionedIds('discarded', user.id));
      fetchDiscarded();
    } else {
      setDiscardedIdsState(new Set(getGuestDiscards()));
    }
  }, [user]);

  const fetchDiscarded = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('discarded_listings')
      .select('listing_id')
      .eq('user_id', user.id);
    
    if (!error && data) {
      setDiscardedIds(new Set(data.map(d => d.listing_id)));
    }
    setLoading(false);
  };

  const addDiscarded = useCallback(async (listingId: string) => {
    if (!user) {
      // Guest/anonymous browsing: persist to sessionStorage so it survives
      // the transition into a real account (merged in on sign-in).
      addGuestDiscard(listingId);
      setDiscardedIds(prev => new Set([...prev, listingId]));
      return true;
    }

    // Optimistic update — unblock UI immediately
    setDiscardedIds(prev => new Set([...prev, listingId]));

    supabase
      .from('discarded_listings')
      .insert({ user_id: user.id, listing_id: listingId })
      .then(({ error }) => {
        if (error && error.code !== '23505') {
          console.error('Failed to discard listing:', error);
          setDiscardedIds(prev => {
            const next = new Set(prev);
            next.delete(listingId);
            return next;
          });
        }
      });

    return true;
  }, [user]);

  const removeDiscarded = useCallback(async (listingId: string) => {
    if (!user) {
      removeGuestDiscard(listingId);
      setDiscardedIds(prev => {
        const next = new Set(prev);
        next.delete(listingId);
        return next;
      });
      return true;
    }

    const { error } = await supabase
      .from('discarded_listings')
      .delete()
      .eq('user_id', user.id)
      .eq('listing_id', listingId);

    if (error) {
      console.error('Failed to remove discarded listing:', error);
      return false;
    }

    setDiscardedIds(prev => {
      const next = new Set(prev);
      next.delete(listingId);
      return next;
    });
    return true;
  }, [user]);

  const clearDiscarded = useCallback(async () => {
    if (!user) return false;

    const { error } = await supabase
      .from('discarded_listings')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to clear discarded listings:', error);
      return false;
    }

    setDiscardedIds(new Set());
    return true;
  }, [user]);

  const isDiscarded = useCallback((listingId: string) => {
    return discardedIds.has(listingId);
  }, [discardedIds]);

  return {
    discardedIds,
    loading,
    addDiscarded,
    removeDiscarded,
    clearDiscarded,
    isDiscarded,
    refetch: fetchDiscarded,
  };
};
