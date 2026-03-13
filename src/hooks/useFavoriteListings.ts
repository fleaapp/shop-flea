import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { DbListing, ListingFilters } from './useListings';
import { getQuerySizesFromKeys, listingSizeKey, normalizeSizeKeys } from '@/utils/sizeKeys';
import { preloadImages } from '@/utils/preloadAssets';

// Extended DbListing to include pause_selling from profiles
export interface DbListingWithPause extends DbListing {
  profiles?: {
    username: string;
    avatar_url: string | null;
    location: string | null;
    rating: number;
    pause_selling?: boolean;
    last_sign_in_at?: string | null;
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
        .select('listing_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

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
    if (filters?.sizes && filters.sizes.length > 0) {
      const querySizes = getQuerySizesFromKeys(filters.sizes);
      query = query.in('size', querySizes);
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
      const normalizedSizeKeys = normalizeSizeKeys(filters?.sizes);
      const sizeKeySet = normalizedSizeKeys.length > 0 ? new Set(normalizedSizeKeys) : null;
      const sizeFiltered = sizeKeySet
        ? data.filter((l) => sizeKeySet.has(listingSizeKey(l.size, l.category, l.gender)))
        : data;

      // Get unique user_ids and fetch all profiles in a single query, including pause_selling
      const uniqueUserIds = [...new Set(sizeFiltered.map(listing => listing.user_id))];
      
      const { data: profilesData } = await supabase
        .from('profiles_public')
        .select('user_id, username, avatar_url, location, rating, pause_selling, last_sign_in_at, status')
        .in('user_id', uniqueUserIds);
      
      // Create a map for quick profile lookup
      const profilesMap = new Map(
        (profilesData || []).map(profile => [profile.user_id, profile])
      );

      // Create a map for favorite order (most recent first)
      const favoriteOrderMap = new Map(
        favorites.map((f, index) => [f.listing_id, index])
      );
      
      // Merge listings with profiles, filter out blocked/banned users
      const listingsWithProfiles = sizeFiltered
        .filter(listing => {
          const profile = profilesMap.get(listing.user_id);
          // Only exclude listings from explicitly blocked users
          return !profile || profile.status !== 'blocked';
        })
        .map(listing => ({
          ...listing,
          profiles: profilesMap.get(listing.user_id) || null,
        }));

      // Preload listing images
      const imagesToPreload = sizeFiltered.flatMap(l => l.images?.slice(0, 1) || []).filter(Boolean);
      if (imagesToPreload.length) preloadImages(imagesToPreload);

      // Sort by the order they were added to favorites (most recent first)
      listingsWithProfiles.sort((a, b) => {
        const orderA = favoriteOrderMap.get(a.id) ?? Number.MAX_VALUE;
        const orderB = favoriteOrderMap.get(b.id) ?? Number.MAX_VALUE;
        return orderA - orderB;
      });
      
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
