import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import FilterChip from '@/components/FilterChip';
import SwipeCard from '@/components/SwipeCard';
import SwipeActions from '@/components/SwipeActions';
import { mockListings } from '@/data/mockListings';
import { Listing } from '@/types/listing';
import { toast } from 'sonner';

const Index = () => {
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>(mockListings);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filters, setFilters] = useState<string[]>(['White t-shirt']);
  const [savedListings, setSavedListings] = useState<Listing[]>([]);
  const [lastAction, setLastAction] = useState<{ listing: Listing; action: 'left' | 'right' } | null>(null);

  const currentListings = listings.slice(currentIndex, currentIndex + 3);

  const handleSwipeLeft = useCallback(() => {
    if (currentIndex < listings.length) {
      const skippedListing = listings[currentIndex];
      setLastAction({ listing: skippedListing, action: 'left' });
      setCurrentIndex((prev) => prev + 1);
      toast('Skipped', { description: skippedListing.title });
    }
  }, [currentIndex, listings]);

  const handleSwipeRight = useCallback(() => {
    if (currentIndex < listings.length) {
      const savedListing = listings[currentIndex];
      setSavedListings((prev) => [...prev, savedListing]);
      setLastAction({ listing: savedListing, action: 'right' });
      setCurrentIndex((prev) => prev + 1);
      toast.success('Saved!', { description: `${savedListing.title} added to favorites` });
    }
  }, [currentIndex, listings]);

  const handleUndo = useCallback(() => {
    if (lastAction && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      if (lastAction.action === 'right') {
        setSavedListings((prev) => prev.filter((l) => l.id !== lastAction.listing.id));
      }
      setLastAction(null);
      toast('Undone!');
    }
  }, [lastAction, currentIndex]);

  const handleCardClick = (listing: Listing) => {
    navigate(`/listing/${listing.id}`, { state: { listing } });
  };

  const removeFilter = (filter: string) => {
    setFilters((prev) => prev.filter((f) => f !== filter));
  };

  const handleSearchClick = () => {
    toast('Search coming soon!');
  };

  const handleFilterClick = () => {
    toast('Filters coming soon!');
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header onSearchClick={handleSearchClick} onFilterClick={handleFilterClick} />
      
      {/* Active Filters */}
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2 px-6 pb-4">
          {filters.map((filter) => (
            <FilterChip key={filter} label={filter} onRemove={() => removeFilter(filter)} />
          ))}
        </div>
      )}
      
      {/* Card Stack */}
      <div className="relative mx-auto h-[520px] max-w-sm px-8 sm:px-6">
        {currentListings.length > 0 ? (
          currentListings.map((listing, index) => (
            <SwipeCard
              key={listing.id}
              listing={listing}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
              onClick={() => handleCardClick(listing)}
              isTop={index === 0}
              index={index}
            />
          )).reverse()
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-lg font-medium text-muted-foreground">No more listings!</p>
            <p className="mt-2 text-sm text-muted-foreground">Check back later for new items</p>
          </div>
        )}
      </div>
      
      {/* Swipe Actions */}
      {currentListings.length > 0 && (
        <SwipeActions
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          onUndo={handleUndo}
          canUndo={!!lastAction}
        />
      )}
      
      <BottomNav />
    </div>
  );
};

export default Index;
