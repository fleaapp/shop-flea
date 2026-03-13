import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Listing } from '@/types/listing';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import { getAvatarUrl } from '@/utils/optimizedImage';
import { preloadImages } from '@/utils/preloadAssets';
import { fetchSellerProfiles } from '@/utils/fetchSellerProfiles';
import {
  createSavedListingSnapshotFromListing,
  loadSavedListingSnapshots,
  saveSavedListingSnapshots,
  type SavedListingSnapshot,
} from '@/utils/savedListingSnapshots';
// Extended Listing type to include pause/inactive/removed status
interface CartListing extends Listing {
  isPaused?: boolean;
  isInactive?: boolean;
  isRemoved?: boolean;
}

interface CartContextType {
  cartItems: CartListing[];
  cartIds: Set<string>;
  loading: boolean;
  addToCart: (listing: Listing) => Promise<boolean>;
  removeFromCart: (id: string) => Promise<boolean>;
  isInCart: (id: string) => boolean;
  clearCart: () => Promise<boolean>;
  refetch: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<CartListing[]>([]);
  const [cartIds, setCartIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchCart = useCallback(async () => {
    if (!user) {
      setCartItems([]);
      setCartIds(new Set());
      return;
    }

    setLoading(true);

    // Keep cart rows intact so removed/deleted listings can render as ⛔ placeholders.
    // We validate access at navigation time instead of deleting saved rows here.

    // Fetch cart item IDs
    const { data: cartData, error: cartError } = await supabase
      .from('cart_items')
      .select('listing_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (cartError || !cartData || cartData.length === 0) {
      setCartItems([]);
      setCartIds(new Set());
      setLoading(false);
      return;
    }

    const listingIds = cartData.map(c => c.listing_id);

    // Fetch full listing data (include all statuses to detect removed/deleted)
    const { data: listingsData, error: listingsError } = await supabase
      .from('listings')
      .select('*')
      .in('id', listingIds);

    if (listingsError || !listingsData) {
      setCartItems([]);
      setCartIds(new Set());
      setLoading(false);
      return;
    }

    // Fetch seller profiles (with fallback if profiles_public is unavailable)
    const userIds = [...new Set(listingsData.map(l => l.user_id))];
    const { profiles, canTrustMissing } = await fetchSellerProfiles(userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    // Create a map for cart order (most recent first)
    const cartOrderMap = new Map(
      cartData.map((c, index) => [c.listing_id, index])
    );

    const isInvalidSeller = (listing: (typeof listingsData)[number]) => {
      const profile = profileMap.get(listing.user_id);
      if (profile?.status === 'blocked') return true;
      return canTrustMissing && !profile;
    };

    const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Detect listing IDs that exist in cart but not in fetched listings (fully deleted rows or RLS-hidden rows)
    const fetchedListingIds = new Set(listingsData.map(l => l.id));
    const missingListingIds = listingIds.filter(id => !fetchedListingIds.has(id));

    const transformedListings: CartListing[] = listingsData.map(listing => {
      const seller = profileMap.get(listing.user_id);
      const lastSignIn = seller?.last_sign_in_at ? new Date(seller.last_sign_in_at).getTime() : now;
      const removedByStatus = listing.status !== 'active' && listing.status !== 'sold';
      const removedBySeller = isInvalidSeller(listing);
      const isRemovedStatus = removedByStatus || removedBySeller;

      return {
        id: listing.id,
        title: listing.title,
        brand: listing.brand,
        size: listing.size,
        price: Number(listing.price),
        shippingPrice: listing.shipping_price ? Number(listing.shipping_price) : 0,
        image: listing.images?.[0] || '',
        images: listing.images || [],
        sellerId: listing.user_id,
        sellerName: seller?.username || 'Unknown Seller',
        sellerAvatar: getAvatarUrl(seller?.avatar_url) || getDefaultAvatar(listing.user_id),
        condition: listing.condition as Listing['condition'],
        category: listing.category,
        description: listing.description || '',
        tags: listing.tags || [],
        location: seller?.location || '',
        createdAt: new Date(listing.created_at),
        status: isRemovedStatus ? 'removed' : listing.status,
        isPaused: isRemovedStatus ? false : (seller?.pause_selling || false),
        isInactive: isRemovedStatus ? false : ((now - lastSignIn) >= TEN_DAYS_MS),
        isRemoved: isRemovedStatus,
      };
    });

    const snapshotsToSave: SavedListingSnapshot[] = listingsData.map((listing) => ({
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
      seller: profileMap.get(listing.user_id) ?? null,
      saved_at: new Date().toISOString(),
    }));

    saveSavedListingSnapshots(user.id, snapshotsToSave);

    // For IDs we can no longer fetch directly, restore from local snapshots first.
    const snapshotMap = loadSavedListingSnapshots(user.id, missingListingIds);

    for (const missingId of missingListingIds) {
      const snapshot = snapshotMap.get(missingId);

      if (snapshot) {
        const seller = snapshot.seller;
        const createdAt = snapshot.listing.created_at
          ? new Date(snapshot.listing.created_at)
          : new Date();

        transformedListings.push({
          id: snapshot.listing.id,
          title: snapshot.listing.title || 'Removed listing',
          brand: snapshot.listing.brand || '',
          size: snapshot.listing.size || '',
          price: Number(snapshot.listing.price || 0),
          shippingPrice: Number(snapshot.listing.shipping_price || 0),
          image: snapshot.listing.images?.[0] || '',
          images: snapshot.listing.images || [],
          sellerId: snapshot.listing.user_id || 'unknown',
          sellerName: seller?.username || 'Unknown Seller',
          sellerAvatar: getAvatarUrl(seller?.avatar_url) || getDefaultAvatar(snapshot.listing.user_id || missingId),
          condition: (snapshot.listing.condition as Listing['condition']) || 'good',
          category: snapshot.listing.category || '',
          description: snapshot.listing.description || '',
          tags: snapshot.listing.tags || [],
          location: seller?.location || '',
          createdAt,
          status: 'removed',
          isPaused: false,
          isInactive: false,
          isRemoved: true,
        });
        continue;
      }

      // Last-resort placeholder (only when no snapshot exists)
      transformedListings.push({
        id: missingId,
        title: 'Removed listing',
        brand: '',
        size: '',
        price: 0,
        shippingPrice: 0,
        image: '',
        images: [],
        sellerId: 'unknown',
        sellerName: 'Unknown',
        sellerAvatar: getDefaultAvatar(missingId),
        condition: 'good',
        category: '',
        description: '',
        tags: [],
        location: '',
        createdAt: new Date(),
        status: 'removed',
        isPaused: false,
        isInactive: false,
        isRemoved: true,
      });
    }

    // Sort by the order they were added to cart (most recent first)
    transformedListings.sort((a, b) => {
      const orderA = cartOrderMap.get(a.id) ?? Number.MAX_VALUE;
      const orderB = cartOrderMap.get(b.id) ?? Number.MAX_VALUE;
      return orderA - orderB;
    });

    // Preload seller avatars for instant display
    const avatarUrls = transformedListings
      .map(l => l.sellerAvatar)
      .filter(url => !!url);
    if (avatarUrls.length > 0) {
      preloadImages(avatarUrls);
    }

    setCartIds(new Set(transformedListings.map(item => item.id)));
    setCartItems(transformedListings);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = useCallback(async (listing: Listing): Promise<boolean> => {
    if (!user) return false;

    const { profiles: sellerProfiles, canTrustMissing } = await fetchSellerProfiles([listing.sellerId]);
    const seller = sellerProfiles[0];
    if ((canTrustMissing && !seller) || seller?.status === 'blocked') {
      return false;
    }

    const { error } = await supabase
      .from('cart_items')
      .insert({ user_id: user.id, listing_id: listing.id });

    if (error) {
      if (error.code === '23505') {
        // Already in cart
        return true;
      }
      console.error('Failed to add to cart:', error);
      return false;
    }

    setCartItems(prev => [...prev, listing]);
    setCartIds(prev => new Set([...prev, listing.id]));
    return true;
  }, [user]);

  const removeFromCart = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', user.id)
      .eq('listing_id', id);

    if (error) {
      console.error('Failed to remove from cart:', error);
      return false;
    }

    setCartItems(prev => prev.filter(item => item.id !== id));
    setCartIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    return true;
  }, [user]);

  const clearCart = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to clear cart:', error);
      return false;
    }

    setCartItems([]);
    setCartIds(new Set());
    return true;
  }, [user]);

  const isInCart = useCallback((id: string) => {
    return cartIds.has(id);
  }, [cartIds]);

  return (
    <CartContext.Provider value={{
      cartItems,
      cartIds,
      loading,
      addToCart,
      removeFromCart,
      isInCart,
      clearCart,
      refetch: fetchCart,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
