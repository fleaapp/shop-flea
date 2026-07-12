import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { preloadImages } from '@/utils/preloadAssets';
import { getQuerySizesFromKeys, listingSizeKey, normalizeSizeKeys } from '@/utils/sizeKeys';
import { filterBySearch } from '@/utils/searchUtils';
import { fetchSellerProfiles } from '@/utils/fetchSellerProfiles';
import { getInvalidListingIds } from '@/utils/listingAccess';
import { subscribeListingInvalidated } from '@/utils/listingInvalidation';

export interface DbListing {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  brand: string;
  size: string;
  category: string;
  subcategory: string | null;
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
  brands?: string[]; // Multi-select brands
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}

const PAGE_SIZE = 50;

export const useListings = (filters?: ListingFilters, options?: { enabled?: boolean }) => {
  const enabled = options?.enabled !== false;
  const { user } = useAuth();
  const [listings, setListings] = useState<DbListing[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Keyset cursor: last seen created_at (for pagination beyond first page)
  const [cursor, setCursor] = useState<string | null>(null);

  const fetchListings = useCallback(async (mode: 'reset' | 'append' = 'reset', cursorOverride?: string | null) => {
    if (!enabled) {
      setLoading(false);
      setLoadingMore(false);
      return;
    }
    if (mode === 'reset') {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    let query = supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    // Keyset cursor for "append" mode
    if (mode === 'append' && cursorOverride) {
      query = query.lt('created_at', cursorOverride);
    }

    // Exclude current user's own listings
    if (user) {
      query = query.neq('user_id', user.id);
    }

    // Apply filters
    if (filters?.category) {
      query = query.eq('category', filters.category.toLowerCase());
    }
    // Note: Multi-select categories filter is now done client-side to support subcategories
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
    // Note: brand filtering is done client-side for case-insensitive matching
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
      if (mode === 'reset') setListings([]);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    // Track whether the raw page was full — that's what determines if more pages exist server-side.
    const rawCount = data?.length ?? 0;
    setHasMore(rawCount === PAGE_SIZE);
    if (rawCount > 0 && data) {
      setCursor(data[data.length - 1].created_at);
    }

    if (data && data.length > 0) {
      // If size keys are in use (e.g. clothing:8 vs shoes:8), apply a second
      // pass to ensure category+size matching (DB only stores size).
      const normalizedSizeKeys = normalizeSizeKeys(filters?.sizes);
      const sizeKeySet = normalizedSizeKeys.length > 0 ? new Set(normalizedSizeKeys) : null;

      const sizeFiltered = sizeKeySet
        ? data.filter((l) => sizeKeySet.has(listingSizeKey(l.size, l.category, l.gender)))
        : data;

      const invalidListingIds = await getInvalidListingIds(
        sizeFiltered.map((listing) => listing.id),
      );

      const validatedListings = invalidListingIds.size > 0
        ? sizeFiltered.filter((listing) => !invalidListingIds.has(listing.id))
        : sizeFiltered;

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

      // Apply client-side categories filtering (supports both parent categories and subcategories)
      if (filters?.categories && filters.categories.length > 0) {
        const catSet = new Set(filters.categories.map(c => c.toLowerCase()));
        listingsWithProfiles = listingsWithProfiles.filter(l =>
          catSet.has(l.category?.toLowerCase()) || (l.subcategory && catSet.has(l.subcategory.toLowerCase()))
        );
      }

      // Apply client-side brand filtering (case-insensitive)
      if (filters?.brands && filters.brands.length > 0) {
        const brandSet = new Set(filters.brands.map(b => b.toLowerCase()));
        listingsWithProfiles = listingsWithProfiles.filter(l =>
          l.brand && brandSet.has(l.brand.toLowerCase())
        );
      }
      
      // Only preload the first few listing images (visible in swipe stack) on initial load
      if (mode === 'reset') {
        const listingImageUrls = listingsWithProfiles
          .slice(0, 3)
          .flatMap(l => l.images?.slice(0, 1) || [])
          .filter(Boolean);
        if (listingImageUrls.length > 0) {
          preloadImages(listingImageUrls);
        }
      }
      
      if (mode === 'append') {
        setListings(prev => {
          const existingIds = new Set(prev.map(l => l.id));
          const merged = [...prev];
          for (const l of listingsWithProfiles) {
            if (!existingIds.has(l.id)) merged.push(l);
          }
          return merged;
        });
      } else {
        setListings(listingsWithProfiles);
      }
    } else if (mode === 'reset') {
      setListings([]);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [enabled, user, filters?.category, filters?.categories, filters?.size, filters?.sizes, filters?.condition, filters?.gender, filters?.genders, filters?.colours, filters?.styles, filters?.brands, filters?.minPrice, filters?.maxPrice, filters?.search]);

  // Reset + fetch first page whenever filters/user change
  useEffect(() => {
    setCursor(null);
    setHasMore(true);
    fetchListings('reset');
  }, [fetchListings]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore || !cursor) return;
    fetchListings('append', cursor);
  }, [loading, loadingMore, hasMore, cursor, fetchListings]);

  return { listings, loading, loadingMore, hasMore, error, refetch: () => fetchListings('reset'), loadMore };
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

      if (status === 'sold') {
        // Fetch orders AND listings marked as sold (includes "sold elsewhere")
        const [ordersResult, soldListingsResult] = await Promise.all([
          supabase
            .from('orders')
            .select('id, listing_id, created_at')
            .eq('seller_id', user.id)
            .order('created_at', { ascending: false })
            .limit(500),
          supabase
            .from('listings')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'sold')
            .order('updated_at', { ascending: false }),
        ]);

        const orders = ordersResult.data || [];
        const allSoldListings = soldListingsResult.data || [];

        // Build order-based sold cards
        const orderListingIds = new Set(orders.map(o => o.listing_id));
        let orderedSoldListings: DbListing[] = [];

        if (orders.length > 0) {
          const listingIds = [...orderListingIds];
          const { data } = await supabase
            .from('listings')
            .select('*')
            .in('id', listingIds)
            .eq('user_id', user.id);

          if (data) {
            const listingMap = new Map(data.map((listing) => [listing.id, listing]));
            orderedSoldListings = orders
              .map((order) => {
                const listing = listingMap.get(order.listing_id);
                if (!listing) return null;
                return {
                  ...listing,
                  id: `${listing.id}::${order.id}`,
                  source_listing_id: listing.id,
                  order_id: order.id,
                  created_at: order.created_at,
                };
              })
              .filter((listing): listing is DbListing => !!listing);
          }
        }

        // Add "sold elsewhere" listings (sold status but no order)
        const soldElsewhere = allSoldListings
          .filter(l => !orderListingIds.has(l.id))
          .map(l => ({
            ...l,
            source_listing_id: l.id,
          }));

        const combined = [...orderedSoldListings, ...soldElsewhere];
        combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setListings(combined);
      } else {
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
      }
      setLoading(false);
    };

    fetchUserListings();
  }, [user, status]);

  return { listings, loading };
};
