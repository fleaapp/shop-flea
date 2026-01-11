import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export const useDiscardedListings = () => {
  const { user } = useAuth();
  const [discardedIds, setDiscardedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDiscarded();
    } else {
      setDiscardedIds(new Set());
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
    if (!user) return false;

    const { error } = await supabase
      .from('discarded_listings')
      .insert({ user_id: user.id, listing_id: listingId });

    if (error) {
      if (error.code === '23505') {
        // Already discarded
        return true;
      }
      console.error('Failed to discard listing:', error);
      return false;
    }

    setDiscardedIds(prev => new Set([...prev, listingId]));
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
    clearDiscarded,
    isDiscarded,
    refetch: fetchDiscarded,
  };
};
