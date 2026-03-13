import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Listing } from '@/types/listing';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import { getAvatarUrl } from '@/utils/optimizedImage';
import { preloadImages } from '@/utils/preloadAssets';

// Extended Listing type to include pause/inactive status
interface CartListing extends Listing {
  isPaused?: boolean;
  isInactive?: boolean;
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
    setCartIds(new Set(listingIds));

    // Fetch full listing data (include sold items to show with SOLD overlay)
    const { data: listingsData, error: listingsError } = await supabase
      .from('listings')
      .select('*')
      .in('id', listingIds)
      .in('status', ['active', 'sold']);

    if (listingsError || !listingsData) {
      setCartItems([]);
      setLoading(false);
      return;
    }

    // Fetch seller profiles including pause_selling and last_sign_in_at
    const userIds = [...new Set(listingsData.map(l => l.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url, rating, pause_selling, last_sign_in_at, status')
      .in('user_id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    // Create a map for cart order (most recent first)
    const cartOrderMap = new Map(
      cartData.map((c, index) => [c.listing_id, index])
    );

    // Transform to Listing type
    // Filter out listings from explicitly blocked/banned users
    const validListingsData = listingsData.filter(listing => {
      const profile = profileMap.get(listing.user_id);
      // Only exclude if profile exists and is blocked; missing profile may be RLS
      return !profile || profile.status !== 'blocked';
    });

    const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const transformedListings: CartListing[] = validListingsData.map(listing => {
      const seller = profileMap.get(listing.user_id);
      const lastSignIn = seller?.last_sign_in_at ? new Date(seller.last_sign_in_at).getTime() : now;
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
        sellerName: seller?.username || 'Unknown',
        sellerAvatar: getAvatarUrl(seller?.avatar_url) || getDefaultAvatar(listing.user_id),
        condition: listing.condition as Listing['condition'],
        category: listing.category,
        description: listing.description || '',
        tags: listing.tags || [],
        location: '',
        createdAt: new Date(listing.created_at),
        status: listing.status,
        isPaused: seller?.pause_selling || false,
        isInactive: (now - lastSignIn) >= TEN_DAYS_MS,
      };
    });

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

    setCartItems(transformedListings);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = useCallback(async (listing: Listing): Promise<boolean> => {
    if (!user) return false;

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
