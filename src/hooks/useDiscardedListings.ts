import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  addGuestDiscard,
  removeGuestDiscard,
  getGuestDiscards,
} from '@/utils/guestDiscards';

export const useDiscardedListings = () => {
  const { user } = useAuth();
  const [discardedIds, setDiscardedIds] = useState<Set<string>>(() => new Set(getGuestDiscards()));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDiscarded();
    } else {
      setDiscardedIds(new Set(getGuestDiscards()));
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
