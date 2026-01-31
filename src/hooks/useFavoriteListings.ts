import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { DbListing, ListingFilters } from './useListings';

// Extended DbListing to include pause_selling from profiles
export interface DbListingWithPause extends DbListing {
  profiles?: {
    username: string;
    avatar_url: string | null;
    location: string | null;
    rating: number;
    pause_selling?: boolean;
  } | null;
}

export const useFavoriteListings = (filters?: ListingFilters) => {
  const { user } = useAuth();
  const [listings, setListings] = useState<DbListingWithPause[]>([]);
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

    // Now fetch the actual listings (include sold items to show with SOLD overlay)
    let query = supabase
      .from('listings')
      .select('*')
      .in('id', favoriteIds)
      .in('status', ['active', 'sold'])
      .order('created_at', { ascending: false })
      .limit(100); // Limit to prevent DoS via large result sets

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
    } else if (data && data.length > 0) {
      // Get unique user_ids and fetch all profiles in a single query, including pause_selling
      const uniqueUserIds = [...new Set(data.map(listing => listing.user_id))];
      
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url, location, rating, pause_selling')
        .in('user_id', uniqueUserIds);
      
      // Create a map for quick profile lookup
      const profilesMap = new Map(
        (profilesData || []).map(profile => [profile.user_id, profile])
      );
      
      // Merge listings with profiles
      const listingsWithProfiles = data.map(listing => ({
        ...listing,
        profiles: profilesMap.get(listing.user_id) || null,
      }));
      
      setListings(listingsWithProfiles);
    } else {
      setListings([]);
    }
    setLoading(false);
  }, [user, filters?.category, filters?.size, filters?.condition, filters?.gender, filters?.minPrice, filters?.maxPrice, filters?.search]);

  useEffect(() => {
    fetchFavoriteListings();
  }, [fetchFavoriteListings]);

  return { listings, loading, refetch: fetchFavoriteListings };
};
