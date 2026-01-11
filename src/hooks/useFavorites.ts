import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export const useFavorites = () => {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    } else {
      setFavoriteIds(new Set());
    }
  }, [user]);

  const fetchFavorites = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('favorites')
      .select('listing_id')
      .eq('user_id', user.id);
    
    if (!error && data) {
      setFavoriteIds(new Set(data.map(f => f.listing_id)));
    }
    setLoading(false);
  };

  const addFavorite = useCallback(async (listingId: string) => {
    if (!user) {
      toast.error('Please sign in to save items');
      return false;
    }

    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: user.id, listing_id: listingId });

    if (error) {
      if (error.code === '23505') {
        // Already favorited
        return true;
      }
      toast.error('Failed to save item');
      return false;
    }

    setFavoriteIds(prev => new Set([...prev, listingId]));
    return true;
  }, [user]);

  const removeFavorite = useCallback(async (listingId: string) => {
    if (!user) return false;

    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('listing_id', listingId);

    if (error) {
      toast.error('Failed to remove item');
      return false;
    }

    setFavoriteIds(prev => {
      const next = new Set(prev);
      next.delete(listingId);
      return next;
    });
    return true;
  }, [user]);

  const isFavorite = useCallback((listingId: string) => {
    return favoriteIds.has(listingId);
  }, [favoriteIds]);

  return {
    favoriteIds,
    loading,
    addFavorite,
    removeFavorite,
    isFavorite,
    refetch: fetchFavorites,
  };
};
