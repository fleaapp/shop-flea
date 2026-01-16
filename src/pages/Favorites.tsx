import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';
import WishlistCard from '@/components/WishlistCard';
import FilterSheet, { FilterState } from '@/components/FilterSheet';
import { useFavoriteListings } from '@/hooks/useFavoriteListings';
import { useFavorites } from '@/hooks/useFavorites';
import { useCart } from '@/context/CartContext';
import { Listing } from '@/types/listing';
import { DbListing, ListingFilters } from '@/hooks/useListings';
import { toast } from '@/hooks/use-toast';

// Convert DbListing to Listing display type
interface DisplayListing extends Listing {
  isSold: boolean;
}

const toDisplayListing = (dbListing: DbListing): DisplayListing => {
  const conditionMap: Record<string, 'new' | 'like-new' | 'good' | 'fair'> = {
    'new': 'new',
    'like-new': 'like-new',
    'excellent': 'like-new',
    'good': 'good',
    'fair': 'fair',
  };
  
  return {
    id: dbListing.id,
    title: dbListing.title,
    price: dbListing.price,
    shippingPrice: dbListing.shipping_price || 0,
    image: dbListing.images?.[0] || '',
    images: dbListing.images || [],
    size: dbListing.size?.toUpperCase() || '',
    brand: dbListing.brand || '',
    location: dbListing.profiles?.location || 'Unknown',
    sellerId: dbListing.user_id,
    sellerName: dbListing.profiles?.username || 'Unknown Seller',
    sellerAvatar: dbListing.profiles?.avatar_url || '',
    description: dbListing.description || '',
    condition: conditionMap[dbListing.condition?.toLowerCase() || ''] || 'good',
    category: dbListing.category || '',
    tags: dbListing.tags || [],
    createdAt: new Date(dbListing.created_at),
    isSold: dbListing.status === 'sold',
  };
};

const Favorites = () => {
  const navigate = useNavigate();
  const [filterOpen, setFilterOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<ListingFilters>({});
  
  const { listings, loading, refetch } = useFavoriteListings(appliedFilters);
  const { removeFavorite } = useFavorites();
  const { addToCart } = useCart();

  const displayListings = useMemo(() => 
    listings.map(toDisplayListing), 
    [listings]
  );

  const handleRemoveFavorite = useCallback(async (listingId: string) => {
    await removeFavorite(listingId);
    toast({
      title: "Removed from wishlist",
      description: "Item has been removed from your wishlist",
    });
    refetch();
  }, [removeFavorite, refetch]);

  const handleAddToCart = useCallback((listing: Listing) => {
    addToCart(listing);
    toast({
      title: "Added to cart",
      description: `${listing.title} has been added to your cart`,
    });
  }, [addToCart]);

  const handleApplyFilters = useCallback((filters: FilterState) => {
    const newFilters: ListingFilters = {};
    
    if (filters.category) newFilters.category = filters.category;
    if (filters.size) newFilters.size = filters.size;
    if (filters.condition) newFilters.condition = filters.condition;
    if (filters.gender) newFilters.gender = filters.gender;
    if (filters.priceRange[0] > 0) newFilters.minPrice = filters.priceRange[0];
    if (filters.priceRange[1] < 1000) newFilters.maxPrice = filters.priceRange[1];
    
    setAppliedFilters(newFilters);
  }, []);

  const hasFilters = Object.keys(appliedFilters).length > 0;

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      {/* Sticky Header */}
      <header className="flex items-center justify-between px-6 py-4 flex-shrink-0">
        <div className="w-12" /> {/* Spacer for centering */}
        <div className="flex items-center gap-2">
          <span className="text-xl">💌</span>
          <h1 className="text-xl font-bold text-foreground">Wishlist</h1>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setFilterOpen(true)}
          className={`h-12 w-12 rounded-xl border-2 border-border bg-card hover:bg-secondary ${hasFilters ? 'bg-primary text-primary-foreground border-primary' : ''}`}
        >
          <SlidersHorizontal className="h-5 w-5" />
        </Button>
      </header>
      
      {/* Listings Horizontal Scroll - centered first card */}
      <div className="flex-1 flex items-center pb-24 max-[393px]:pb-20 max-[375px]:pb-16 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center w-full">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : displayListings.length > 0 ? (
          <div 
            className="flex gap-4 max-[375px]:gap-3 overflow-x-auto snap-x snap-mandatory h-full items-center px-[calc(50vw-min(170px,42vw))]"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <style>{`.flex::-webkit-scrollbar { display: none; }`}</style>
            {displayListings.map((listing) => (
              <div key={listing.id} className="flex-shrink-0 snap-center">
                <WishlistCard 
                  listing={listing} 
                  onRemove={() => handleRemoveFavorite(listing.id)}
                  onAddToCart={() => handleAddToCart(listing)}
                  isSold={listing.isSold}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full text-center px-4">
            <span className="text-6xl mb-4">💌</span>
            <p className="text-lg font-medium text-muted-foreground">
              {hasFilters ? 'No items match your filters' : 'No saved items yet'}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {hasFilters ? 'Try adjusting your filters' : 'Swipe right on items you like'}
            </p>
            <Button
              onClick={() => hasFilters ? setAppliedFilters({}) : navigate('/')}
              className="mt-6 rounded-full bg-primary text-primary-foreground"
            >
              {hasFilters ? 'Clear Filters' : 'Browse Listings'}
            </Button>
          </div>
        )}
      </div>
      
      <FilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        onApplyFilters={handleApplyFilters}
      />
      
      <BottomNav />
    </div>
  );
};

export default Favorites;
