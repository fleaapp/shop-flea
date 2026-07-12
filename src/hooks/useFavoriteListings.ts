import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { DbListing, ListingFilters } from './useListings';
import { getQuerySizesFromKeys, listingSizeKey, normalizeSizeKeys } from '@/utils/sizeKeys';
import { preloadImages } from '@/utils/preloadAssets';
import { fetchSellerProfiles } from '@/utils/fetchSellerProfiles';
import { loadSavedListingSnapshots, saveSavedListingSnapshots, type SavedListingSnapshot } from '@/utils/savedListingSnapshots';
import { subscribeListingInvalidated, shouldPurgeSnapshot } from '@/utils/listingInvalidation';
import { getGuestFavorites } from '@/utils/guestWishlist';

// Extended DbListing to include pause_selling from profiles
export interface DbListingWithPause extends DbListing {
  profiles?: {
    username: string;
    avatar_url: string | null;
    location: string | null;
    rating: number;
    pause_selling?: boolean;
    last_sign_in_at?: string | null;
    status?: string | null;
  } | null;
}

export const useFavoriteListings = (filters?: ListingFilters) => {
  const { user } = useAuth();
  const [listings, setListings] = useState<DbListingWithPause[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavoriteListings = useCallback(async () => {
    if (!user) {
      // Guest mode: hydrate from session-scoped wishlist snapshots.
      const guestItems = getGuestFavorites();
      const mapped: DbListingWithPause[] = guestItems.map((l) => ({
        id: l.id,
        title: l.title,
        brand: l.brand || '',
        size: l.size || '',
        price: Number(l.price || 0),
        shipping_price: Number((l as any).shippingPrice ?? (l as any).shipping_price ?? 0),
        images: l.images || (l.image ? [l.image] : []),
        tags: l.tags || [],
        condition: (l.condition as string) || 'good',
        category: l.category || '',
        description: l.description || '',
        user_id: l.sellerId || 'unknown',
        status: 'active',
        created_at: (l.createdAt instanceof Date ? l.createdAt.toISOString() : new Date().toISOString()),
        updated_at: new Date().toISOString(),
        report_count: 0,
        colour: null,
        style: null,
        gender: null,
        country_code: null,
        region_id: null,
        profiles: {
          username: l.sellerName || 'Unknown',
          avatar_url: l.sellerAvatar || null,
          location: l.location || null,
          rating: 0,
          pause_selling: false,
          last_sign_in_at: null,
          status: null,
        },
      } as unknown as DbListingWithPause));
      setListings(mapped);
      setLoading(false);
      return;
    }


    setLoading(true);

    // Keep wishlist rows intact so removed/deleted listings can render as ⛔ placeholders.

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

    // Now fetch the actual listings (include all statuses to detect removed)
    let query = supabase
      .from('listings')
      .select('*')
      .in('id', favoriteIds)
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

      // Get unique user_ids and fetch profiles (with fallback if profiles_public is unavailable)
      const uniqueUserIds = [...new Set(sizeFiltered.map(listing => listing.user_id))];
      const { profiles: profilesData, canTrustMissing } = await fetchSellerProfiles(uniqueUserIds);

      // Create a map for quick profile lookup
      const profilesMap = new Map(
        (profilesData || []).map(profile => [profile.user_id, profile])
      );

      const isInvalidSeller = (listing: DbListingWithPause) => {
        const profile = profilesMap.get(listing.user_id);
        if (profile?.status === 'blocked') return true;
        return canTrustMissing && !profile;
      };

      // Keep listing details even when seller is invalid; just mark these items as removed for UI
      const listingsWithProfiles = sizeFiltered.map(listing => {
        const profile = profilesMap.get(listing.user_id) || null;
        const removedBySeller = isInvalidSeller(listing);

        return {
          ...listing,
          status: removedBySeller ? 'removed' : listing.status,
          profiles: profile,
        };
      });

      const snapshotsToSave: SavedListingSnapshot[] = sizeFiltered.map((listing) => ({
        listing: {
          id: listing.id,
          user_id: listing.user_id,
          title: listing.title,
          description: listing.description ?? null,
          brand: listing.brand,
          size: listing.size,
          category: listing.category,
          condition: listing.condition,
          colour: listing.colour ?? null,
          style: listing.style ?? null,
          gender: listing.gender ?? null,
          price: Number(listing.price),
          shipping_price: listing.shipping_price ?? 0,
          images: listing.images ?? [],
          tags: listing.tags ?? [],
          status: listing.status ?? null,
          created_at: listing.created_at,
          updated_at: listing.updated_at,
          country_code: listing.country_code ?? null,
          region_id: listing.region_id ?? null,
        },
        seller: profilesMap.get(listing.user_id) ?? null,
        saved_at: new Date().toISOString(),
      }));

      saveSavedListingSnapshots(user.id, snapshotsToSave);

      // Detect missing listing IDs (fully deleted rows or RLS-hidden rows) and recover from local snapshots
      const fetchedIds = new Set(sizeFiltered.map(l => l.id));
      const missingIds = favoriteIds.filter(id => !fetchedIds.has(id));
      const snapshotMap = loadSavedListingSnapshots(user.id, missingIds);

      for (const missingId of missingIds) {
        const snapshot = snapshotMap.get(missingId);

        if (snapshot) {
          listingsWithProfiles.push({
            id: snapshot.listing.id,
            title: snapshot.listing.title || 'Removed listing',
            brand: snapshot.listing.brand || '',
            size: snapshot.listing.size || '',
            price: Number(snapshot.listing.price || 0),
            shipping_price: Number(snapshot.listing.shipping_price || 0),
            images: snapshot.listing.images || [],
            tags: snapshot.listing.tags || [],
            condition: snapshot.listing.condition || 'good',
            category: snapshot.listing.category || '',
            description: snapshot.listing.description || '',
            user_id: snapshot.listing.user_id || 'unknown',
            status: 'removed',
            created_at: snapshot.listing.created_at || new Date().toISOString(),
            updated_at: snapshot.listing.updated_at || new Date().toISOString(),
            report_count: 0,
            colour: snapshot.listing.colour ?? null,
            style: snapshot.listing.style ?? null,
            gender: snapshot.listing.gender ?? null,
            subcategory: (snapshot.listing as any).subcategory ?? null,
            country_code: snapshot.listing.country_code ?? null,
            region_id: snapshot.listing.region_id ?? null,
            profiles: snapshot.seller
              ? {
                  username: snapshot.seller.username || 'Unknown Seller',
                  avatar_url: snapshot.seller.avatar_url,
                  location: snapshot.seller.location,
                  rating: snapshot.seller.rating,
                  pause_selling: false,
                  last_sign_in_at: snapshot.seller.last_sign_in_at,
                  status: snapshot.seller.status,
                }
              : null,
          } as DbListingWithPause);
          continue;
        }

        // Last-resort placeholder when no snapshot exists.
        listingsWithProfiles.push({
          id: missingId,
          title: 'Removed listing',
          brand: '',
          size: '',
          price: 0,
          shipping_price: 0,
          images: [],
          tags: [],
          condition: 'good',
          category: '',
          description: '',
          user_id: 'unknown',
          status: 'removed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          report_count: 0,
          colour: null,
          style: null,
          gender: null,
          country_code: null,
          region_id: null,
          profiles: null,
        } as any);
      }

      // Create a map for favorite order (most recent first)
      const favoriteOrderMap = new Map(
        favorites.map((f, index) => [f.listing_id, index])
      );

      // Preload listing images
      const imagesToPreload = listingsWithProfiles.flatMap(l => l.images?.slice(0, 1) || []).filter(Boolean);
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
  }, [user, filters?.category, filters?.size, filters?.sizes, filters?.condition, filters?.gender, filters?.minPrice, filters?.maxPrice, filters?.search]);

  useEffect(() => {
    fetchFavoriteListings();
  }, [fetchFavoriteListings]);

  // Guests: refresh when the session wishlist changes.
  useEffect(() => {
    if (user) return;
    const handler = () => fetchFavoriteListings();
    window.addEventListener('flea-guest-wishlist-change', handler);
    return () => window.removeEventListener('flea-guest-wishlist-change', handler);
  }, [user, fetchFavoriteListings]);

  // Realtime removal: drop hard-deleted / removed / blocked listings from the
  // wishlist immediately. Sold items are left alone so the ✅ Sold badge stays.
  useEffect(() => {
    return subscribeListingInvalidated(({ id, reason }) => {
      if (!shouldPurgeSnapshot(reason)) return;
      setListings((prev) => prev.filter((l) => l.id !== id));
    });
  }, []);

  return { listings, loading, refetch: fetchFavoriteListings };
};


