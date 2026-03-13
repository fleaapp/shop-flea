import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Listing } from '@/types/listing';
import { fetchSellerProfiles } from '@/utils/fetchSellerProfiles';
import {
  createSavedListingSnapshotFromListing,
  saveSavedListingSnapshots,
} from '@/utils/savedListingSnapshots';

const conditionValues: Listing['condition'][] = ['new', 'like-new', 'good', 'fair'];

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

  const persistFavoriteSnapshot = useCallback(async (listingId: string, listing?: Listing) => {
    if (!user) return;

    if (listing) {
      saveSavedListingSnapshots(user.id, [createSavedListingSnapshotFromListing(listing)]);
      return;
    }

    const { data: dbListing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .maybeSingle();

    if (listingError || !dbListing) {
      return;
    }

    const { profiles } = await fetchSellerProfiles([dbListing.user_id]);
    const seller = profiles[0];

    const condition = conditionValues.includes(dbListing.condition as Listing['condition'])
      ? (dbListing.condition as Listing['condition'])
      : 'good';

    const listingForSnapshot: Listing = {
      id: dbListing.id,
      title: dbListing.title,
      price: Number(dbListing.price),
      shippingPrice: Number(dbListing.shipping_price ?? 0),
      description: dbListing.description || '',
      image: dbListing.images?.[0] || '',
      images: dbListing.images || [],
      category: dbListing.category || '',
      size: dbListing.size || '',
      brand: dbListing.brand || '',
      tags: dbListing.tags || [],
      sellerId: dbListing.user_id,
      sellerName: seller?.username || 'Unknown Seller',
      sellerAvatar: seller?.avatar_url || '',
      location: seller?.location || '',
      createdAt: dbListing.created_at ? new Date(dbListing.created_at) : new Date(),
      condition,
      status: dbListing.status || 'active',
    };

    saveSavedListingSnapshots(user.id, [
      createSavedListingSnapshotFromListing(listingForSnapshot, seller
        ? {
            user_id: seller.user_id,
            username: seller.username,
            avatar_url: seller.avatar_url,
            location: seller.location,
            rating: seller.rating,
            pause_selling: seller.pause_selling,
            last_sign_in_at: seller.last_sign_in_at,
            status: seller.status,
          }
        : null),
    ]);
  }, [user]);

  const addFavorite = useCallback(async (listingId: string, listing?: Listing) => {
    if (!user) {
      toast.error('Please sign in to save items');
      return false;
    }

    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: user.id, listing_id: listingId });

    if (error && error.code !== '23505') {
      toast.error('Failed to save item');
      return false;
    }

    try {
      await persistFavoriteSnapshot(listingId, listing);
    } catch (snapshotError) {
      console.warn('Failed to persist wishlist snapshot:', snapshotError);
    }

    setFavoriteIds(prev => new Set([...prev, listingId]));
    return true;
  }, [user, persistFavoriteSnapshot]);

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
