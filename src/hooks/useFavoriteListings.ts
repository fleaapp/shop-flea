import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { DbListing, ListingFilters } from './useListings';

export const useFavoriteListings = (filters?: ListingFilters) => {
  const { user } = useAuth();
  const [listings, setListings] = useState<DbListing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavoriteListings = useCallback(async () => {
    if (!user) {
      setListings([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // First get the user's favorite listing IDs
    const { data: favorites, error: favError } = await supabase
      .from('favorites')
      .select('listing_id')
      .eq('user_id', user.id);

    if (favError || !favorites || favorites.length === 0) {
      setListings([]);
      setLoading(false);
      return;
    }

    const favoriteIds = favorites.map(f => f.listing_id);

    // Now fetch the actual listings
    let query = supabase
      .from('listings')
      .select('*')
      .in('id', favoriteIds)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.category) {
      query = query.eq('category', filters.category.toLowerCase());
    }
    if (filters?.size) {
      query = query.eq('size', filters.size.toLowerCase());
    }
    if (filters?.condition) {
      query = query.eq('condition', filters.condition.toLowerCase());
    }
    if (filters?.gender) {
      query = query.eq('gender', filters.gender.toLowerCase());
    }
    if (filters?.minPrice !== undefined) {
      query = query.gte('price', filters.minPrice);
    }
    if (filters?.maxPrice !== undefined) {
      query = query.lte('price', filters.maxPrice);
    }
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,brand.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) {
      setListings([]);
    } else {
      // Fetch profiles for each listing
      const listingsWithProfiles = await Promise.all(
        (data || []).map(async (listing) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username, avatar_url, location, rating')
            .eq('user_id', listing.user_id)
            .maybeSingle();
          return { ...listing, profiles: profileData };
        })
      );
      setListings(listingsWithProfiles);
    }
    setLoading(false);
  }, [user, filters?.category, filters?.size, filters?.condition, filters?.gender, filters?.minPrice, filters?.maxPrice, filters?.search]);

  useEffect(() => {
    fetchFavoriteListings();
  }, [fetchFavoriteListings]);

  return { listings, loading, refetch: fetchFavoriteListings };
};
