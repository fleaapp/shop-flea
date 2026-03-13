import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { preloadImages } from '@/utils/preloadAssets';
import { getQuerySizesFromKeys, listingSizeKey, normalizeSizeKeys } from '@/utils/sizeKeys';
import { filterBySearch } from '@/utils/searchUtils';
import { fetchSellerProfiles } from '@/utils/fetchSellerProfiles';
import { invokeCloudFunction } from '@/utils/cloudFunctions';

export interface DbListing {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  brand: string;
  size: string;
  category: string;
  condition: string;
  colour: string | null;
  style: string | null;
  gender: string | null;
  price: number;
  shipping_price: number;
  images: string[];
  tags: string[];
  status: string;
  created_at: string;
  updated_at: string;
  // Joined profile data
  profiles?: {
    username: string;
    avatar_url: string | null;
    location: string | null;
    rating: number | null;
    pause_selling?: boolean;
    status?: string | null;
  } | null;
}

export interface ListingFilters {
  category?: string;
  categories?: string[]; // Multi-select categories
  size?: string;
  sizes?: string[]; // Multi-select sizes
  condition?: string;
  gender?: string;
  genders?: string[]; // Multi-select genders
  colours?: string[]; // Multi-select colours
  styles?: string[]; // Multi-select styles
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}

export const useListings = (filters?: ListingFilters) => {
  const { user } = useAuth();
  const [listings, setListings] = useState<DbListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100); // Limit to prevent DoS via large result sets

    // Exclude current user's own listings
    if (user) {
      query = query.neq('user_id', user.id);
    }

    // Apply filters
    if (filters?.category) {
      query = query.eq('category', filters.category.toLowerCase());
    }
    // Multi-select categories filter
    if (filters?.categories && filters.categories.length > 0) {
      query = query.in('category', filters.categories.map(c => c.toLowerCase()));
    }
    if (filters?.size) {
      query = query.eq('size', filters.size.toLowerCase());
    }
    // Multi-select sizes filter
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
    // Multi-select genders filter
    if (filters?.genders && filters.genders.length > 0) {
      query = query.in('gender', filters.genders.map(g => g.toLowerCase()));
    }
    // Multi-select colours filter
    if (filters?.colours && filters.colours.length > 0) {
      query = query.in('colour', filters.colours.map(c => c.toLowerCase()));
    }
    // Multi-select styles filter
    if (filters?.styles && filters.styles.length > 0) {
      query = query.in('style', filters.styles.map(s => s.toLowerCase()));
    }
    if (filters?.minPrice !== undefined) {
      query = query.gte('price', filters.minPrice);
    }
    if (filters?.maxPrice !== undefined) {
      query = query.lte('price', filters.maxPrice);
    }
    // Note: search filtering is done client-side for better multi-word support

    const { data, error: queryError } = await query;

    if (queryError) {
      setError(queryError.message);
      setListings([]);
    } else if (data && data.length > 0) {
      // If size keys are in use (e.g. clothing:8 vs shoes:8), apply a second
      // pass to ensure category+size matching (DB only stores size).
      const normalizedSizeKeys = normalizeSizeKeys(filters?.sizes);
      const sizeKeySet = normalizedSizeKeys.length > 0 ? new Set(normalizedSizeKeys) : null;

      let validatedListings = sizeFiltered;
      try {
        const { data: validationData, error: validationError } = await invokeCloudFunction(
          'cleanup-stale-saved-listings',
          {
            listingIds: sizeFiltered.map((listing) => listing.id),
            performCleanup: false,
          }
        );

        if (validationError) {
          console.error('Failed to validate Home listings against seller existence:', validationError);
        } else {
          const invalidListingIds = new Set(
            Array.isArray((validationData as { invalidListingIds?: string[] } | null)?.invalidListingIds)
              ? (validationData as { invalidListingIds: string[] }).invalidListingIds
              : []
          );

          if (invalidListingIds.size > 0) {
            validatedListings = sizeFiltered.filter((listing) => !invalidListingIds.has(listing.id));
          }
        }
      } catch (validationError) {
        console.error('Failed to validate Home listings against seller existence:', validationError);
      }

      // Get unique user_ids and fetch seller profiles (schema-safe + RLS-aware)
      const uniqueUserIds = [...new Set(validatedListings.map(listing => listing.user_id))];
      const { profiles: profilesData, canTrustMissing } = await fetchSellerProfiles(uniqueUserIds);

      // Create a map for quick profile lookup
      const profilesMap = new Map(
        (profilesData || []).map(profile => [profile.user_id, profile])
      );

      const isInvalidSeller = (listing: DbListing) => {
        const profile = profilesMap.get(listing.user_id);
        if (profile?.status === 'blocked') return true;
        if (canTrustMissing && !profile) return true;
        return !!profile?.pause_selling;
      };

      // Merge listings with profiles and exclude deleted/blocked/paused sellers
      let listingsWithProfiles = validatedListings
        .filter((listing) => !isInvalidSeller(listing))
        .map(listing => ({
          ...listing,
          profiles: profilesMap.get(listing.user_id) || null,
        }));
      
      // Apply client-side search filtering for multi-word, token-based search
      if (filters?.search) {
        listingsWithProfiles = filterBySearch(listingsWithProfiles, filters.search);
      }
      
      // Preload seller avatars and listing images in the background
      const avatarUrls = listingsWithProfiles
        .map(l => l.profiles?.avatar_url)
        .filter((url): url is string => !!url);
      const listingImageUrls = listingsWithProfiles
        .flatMap(l => l.images?.slice(0, 1) || []) // First image of each listing
        .filter(Boolean);
      if (avatarUrls.length > 0 || listingImageUrls.length > 0) {
        preloadImages([...avatarUrls, ...listingImageUrls]);
      }
      
      setListings(listingsWithProfiles);
    } else {
      setListings([]);
    }
    setLoading(false);
  }, [user, filters?.category, filters?.categories, filters?.size, filters?.sizes, filters?.condition, filters?.gender, filters?.genders, filters?.colours, filters?.styles, filters?.minPrice, filters?.maxPrice, filters?.search]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return { listings, loading, error, refetch: fetchListings };
};

export const useUserListings = (status?: 'active' | 'sold' | 'archived') => {
  const { user } = useAuth();
  const [listings, setListings] = useState<DbListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setListings([]);
      setLoading(false);
      return;
    }

    const fetchUserListings = async () => {
      setLoading(true);
      let query = supabase
        .from('listings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      
      if (!error && data) {
        setListings(data);
      }
      setLoading(false);
    };

    fetchUserListings();
  }, [user, status]);

  return { listings, loading };
};
