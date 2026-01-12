import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import FilterChip from '@/components/FilterChip';
import SwipeCard from '@/components/SwipeCard';
import FilterSheet, { FilterState } from '@/components/FilterSheet';
import SearchSheet from '@/components/SearchSheet';
import { useListings, DbListing } from '@/hooks/useListings';
import { useFavorites } from '@/hooks/useFavorites';
import { useDiscardedListings } from '@/hooks/useDiscardedListings';
import { useCart } from '@/context/CartContext';
import { toast } from 'sonner';
import { Listing } from '@/types/listing';

// Convert DbListing to Listing format for components that expect it
const toDisplayListing = (dbListing: DbListing): Listing => ({
  id: dbListing.id,
  title: dbListing.title,
  price: dbListing.price,
  shippingPrice: dbListing.shipping_price || 0,
  description: dbListing.description || '',
  image: dbListing.images?.[0] || '',
  images: dbListing.images,
  category: dbListing.category,
  size: dbListing.size,
  brand: dbListing.brand,
  tags: dbListing.tags || [],
  sellerId: dbListing.user_id,
  sellerName: dbListing.profiles?.username || '@user',
  sellerAvatar: dbListing.profiles?.avatar_url || '',
  location: dbListing.profiles?.location || 'Unknown',
  createdAt: new Date(dbListing.created_at),
  condition: (dbListing.condition as 'new' | 'like-new' | 'good' | 'fair') || 'good',
});

const Index = () => {
  const navigate = useNavigate();
  const { addToCart, isInCart } = useCart();
  const { addFavorite, favoriteIds } = useFavorites();
  const { addDiscarded, discardedIds } = useDiscardedListings();

  const [optimisticallyHiddenIds, setOptimisticallyHiddenIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<string[]>([]);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);

  // Build filter object from active filter chips
  const listingFilters = useMemo(() => {
    const filterObj: Record<string, string> = {};
    // Simple parsing - could be enhanced
    filters.forEach(f => {
      const lowerF = f.toLowerCase();
      if (['tops', 'bottoms', 'shoes', 'accessories', 'outerwear'].includes(lowerF)) {
        filterObj.category = lowerF;
      } else if (['xs', 's', 'm', 'l', 'xl', 'xxl'].includes(lowerF)) {
        filterObj.size = lowerF;
      } else if (['new', 'like-new', 'good', 'fair'].includes(lowerF)) {
        filterObj.condition = lowerF;
      } else if (['mens', 'womens', 'unisex'].includes(lowerF)) {
        filterObj.gender = lowerF;
      } else {
        filterObj.search = f;
      }
    });
    return filterObj;
  }, [filters]);

  const { listings: dbListings, loading } = useListings(listingFilters);

  // Filter out listings that are discarded, favorited, or in cart
  const availableListings = useMemo(() => {
    return dbListings.filter(listing => 
      !discardedIds.has(listing.id) && 
      !favoriteIds.has(listing.id) && 
      !isInCart(listing.id) &&
      !optimisticallyHiddenIds.has(listing.id)
    );
  }, [dbListings, discardedIds, favoriteIds, isInCart, optimisticallyHiddenIds]);

  const currentListings = availableListings.slice(0, 3);

  const handleSwipeLeft = useCallback(async (listingId: string) => {
    // Optimistic UI: hide immediately so the deck doesn't "skip".
    setOptimisticallyHiddenIds(prev => new Set([...prev, listingId]));
    const success = await addDiscarded(listingId);
    if (!success) {
      setOptimisticallyHiddenIds(prev => {
        const next = new Set(prev);
        next.delete(listingId);
        return next;
      });
    }
  }, [addDiscarded]);

  const handleSwipeRight = useCallback(async (listingId: string) => {
    setOptimisticallyHiddenIds(prev => new Set([...prev, listingId]));
    const success = await addFavorite(listingId);
    if (!success) {
      setOptimisticallyHiddenIds(prev => {
        const next = new Set(prev);
        next.delete(listingId);
        return next;
      });
    }
  }, [addFavorite]);

  const handleSwipeUp = useCallback(async (listing: DbListing) => {
    setOptimisticallyHiddenIds(prev => new Set([...prev, listing.id]));
    const success = await addToCart(toDisplayListing(listing));
    if (!success) {
      setOptimisticallyHiddenIds(prev => {
        const next = new Set(prev);
        next.delete(listing.id);
        return next;
      });
    }
  }, [addToCart]);

  const handleCardClick = (listing: DbListing) => {
    navigate(`/listing/${listing.id}`);
  };

  const removeFilter = (filter: string) => {
    setFilters((prev) => prev.filter((f) => f !== filter));
  };

  const handleSearchClick = () => {
    setSearchSheetOpen(true);
  };

  const handleSearch = (query: string) => {
    setFilters(prev => {
      if (prev.includes(query)) return prev;
      return [...prev, query];
    });
  };

  const handleFilterClick = () => {
    setFilterSheetOpen(true);
  };

  const handleApplyFilters = (filterState: FilterState) => {
    const activeFilters: string[] = [];
    if (filterState.category) activeFilters.push(filterState.category);
    if (filterState.size) activeFilters.push(filterState.size);
    if (filterState.condition) activeFilters.push(filterState.condition);
    if (filterState.gender) activeFilters.push(filterState.gender);
    setFilters(activeFilters);
    toast.success('Filters applied!');
  };

  // Convert listings for search sheet (still uses mock format)
  const searchListings = dbListings.map(toDisplayListing);

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      <Header onSearchClick={handleSearchClick} onFilterClick={handleFilterClick} />
      
      {/* Active Filters */}
      {filters.length > 0 && (
        <div className="flex gap-2 px-6 pb-2 flex-shrink-0 overflow-x-auto scrollbar-hide">
          {filters.map((filter) => {
            // Capitalize sizes (XS, S, M, L, XL, XXL) and first letter of other filters
            const sizes = ['xs', 's', 'm', 'l', 'xl', 'xxl', 'one size'];
            const displayLabel = sizes.includes(filter.toLowerCase())
              ? filter.toUpperCase()
              : filter.charAt(0).toUpperCase() + filter.slice(1);
            return (
              <FilterChip key={filter} label={displayLabel} onRemove={() => removeFilter(filter)} />
            );
          })}
        </div>
      )}
      
      {/* Card Stack - centered with space for fixed nav */}
      <div className="flex-1 flex items-center justify-center pb-24 min-h-0">
        <div className="relative w-full max-w-[340px] h-[68vh] max-h-[520px] px-5">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              <p className="mt-4 text-sm text-muted-foreground">Loading listings...</p>
            </div>
          ) : currentListings.length > 0 ? (
            <AnimatePresence initial={false}>
              {currentListings.map((dbListing, index) => (
                <SwipeCard
                  key={dbListing.id}
                  listing={toDisplayListing(dbListing)}
                  onSwipeLeft={() => handleSwipeLeft(dbListing.id)}
                  onSwipeRight={() => handleSwipeRight(dbListing.id)}
                  onSwipeUp={() => handleSwipeUp(dbListing)}
                  onClick={() => handleCardClick(dbListing)}
                  isTop={index === 0}
                  index={index}
                />
              ))}
            </AnimatePresence>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-lg font-medium text-muted-foreground">No more listings!</p>
              <p className="mt-2 text-sm text-muted-foreground">Check back later for new items</p>
            </div>
          )}
        </div>
      </div>
      
      <FilterSheet 
        open={filterSheetOpen} 
        onOpenChange={setFilterSheetOpen}
        onApplyFilters={handleApplyFilters}
      />
      <SearchSheet
        open={searchSheetOpen}
        onOpenChange={setSearchSheetOpen}
        onSearch={handleSearch}
        listings={searchListings}
      />
      <BottomNav />
    </div>
  );
};

export default Index;
