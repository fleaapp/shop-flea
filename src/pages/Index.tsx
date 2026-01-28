import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useOnboarding } from '@/context/OnboardingContext';
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
  const { addToCart, removeFromCart, isInCart } = useCart();
  const { addFavorite, removeFavorite, favoriteIds } = useFavorites();
  const { addDiscarded, removeDiscarded, discardedIds } = useDiscardedListings();
  const { checkAndTriggerOnboarding } = useOnboarding();

  // Check if we should start onboarding (for new users after signup)
  useEffect(() => {
    checkAndTriggerOnboarding();
  }, [checkAndTriggerOnboarding]);

  const [pendingExitId, setPendingExitId] = useState<string | null>(null);
  const [filters, setFilters] = useState<string[]>([]);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  
  // Track the last action for undo functionality
  const [lastAction, setLastAction] = useState<{
    listingId: string;
    type: 'discard' | 'favorite' | 'cart';
  } | null>(null);

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

  // Filter out listings that are discarded, favorited, or in cart.
  // IMPORTANT: while the top card is animating out, keep it in the stack so
  // the two cards behind don't collapse/disappear.
  const availableListings = useMemo(() => {
    return dbListings.filter((listing) => {
      if (pendingExitId && listing.id === pendingExitId) return true;

      return (
        !discardedIds.has(listing.id) &&
        !favoriteIds.has(listing.id) &&
        !isInCart(listing.id)
      );
    });
  }, [dbListings, discardedIds, favoriteIds, isInCart, pendingExitId]);

  const currentListings = availableListings.slice(0, 3);

  const handleSwipeLeft = useCallback(async (listingId: string) => {
    if (pendingExitId) return;

    setPendingExitId(listingId);
    await addDiscarded(listingId);
    setLastAction({ listingId, type: 'discard' });
  }, [addDiscarded, pendingExitId]);

  const handleSwipeRight = useCallback(async (listingId: string) => {
    if (pendingExitId) return;

    setPendingExitId(listingId);
    await addFavorite(listingId);
    setLastAction({ listingId, type: 'favorite' });
  }, [addFavorite, pendingExitId]);

  const handleSwipeUp = useCallback(async (listing: DbListing) => {
    if (pendingExitId) return;

    setPendingExitId(listing.id);
    await addToCart(toDisplayListing(listing));
    setLastAction({ listingId: listing.id, type: 'cart' });
  }, [addToCart, pendingExitId]);

  const handleUndo = useCallback(async () => {
    if (!lastAction) return;

    const { listingId, type } = lastAction;
    
    if (type === 'discard') {
      await removeDiscarded(listingId);
    } else if (type === 'favorite') {
      await removeFavorite(listingId);
    } else if (type === 'cart') {
      await removeFromCart(listingId);
    }
    
    setLastAction(null);
    toast.success('Action undone!');
  }, [lastAction, removeDiscarded, removeFavorite, removeFromCart]);

  const handleTopExitComplete = useCallback(() => {
    setPendingExitId(null);
  }, []);

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
    setPendingExitId(null);
    toast.success('Filters applied!');
  };

  // Convert listings for search sheet (still uses mock format)
  const searchListings = dbListings.map(toDisplayListing);

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      <Header onSearchClick={handleSearchClick} onFilterClick={handleFilterClick} onUndoClick={handleUndo} canUndo={!!lastAction} />
      
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
      <div className="flex-1 flex items-center justify-center pb-24 max-[393px]:pb-20 max-[375px]:pb-16 min-h-0">
        <div className="relative w-full max-w-[min(340px,85vw)] h-[min(68vh,520px)] max-[393px]:h-[min(58vh,440px)] max-[375px]:h-[min(55vh,400px)] px-5 max-[375px]:px-3">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="text-5xl">⏳</span>
            </div>
          ) : currentListings.length > 0 ? (
            <>
              {currentListings.map((dbListing, index) => (
                <SwipeCard
                  key={dbListing.id}
                  listing={toDisplayListing(dbListing)}
                  onSwipeLeft={() => handleSwipeLeft(dbListing.id)}
                  onSwipeRight={() => handleSwipeRight(dbListing.id)}
                  onSwipeUp={() => handleSwipeUp(dbListing)}
                  onExitComplete={index === 0 ? handleTopExitComplete : undefined}
                  onClick={() => handleCardClick(dbListing)}
                  isTop={index === 0}
                  index={index}
                />
              ))}
            </>
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
