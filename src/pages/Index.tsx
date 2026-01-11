import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import FilterChip from '@/components/FilterChip';
import SwipeCard from '@/components/SwipeCard';
import FilterSheet, { FilterState } from '@/components/FilterSheet';
import SearchSheet from '@/components/SearchSheet';
import { mockListings } from '@/data/mockListings';
import { Listing } from '@/types/listing';
import { toast } from 'sonner';

const Index = () => {
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>(mockListings);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filters, setFilters] = useState<string[]>([]);
  const [savedListings, setSavedListings] = useState<Listing[]>([]);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);

  const currentListings = listings.slice(currentIndex, currentIndex + 3);

  const handleSwipeLeft = useCallback(() => {
    if (currentIndex < listings.length) {
      const skippedListing = listings[currentIndex];
      setCurrentIndex((prev) => prev + 1);
      toast('Skipped', { description: skippedListing.title });
    }
  }, [currentIndex, listings]);

  const handleSwipeRight = useCallback(() => {
    if (currentIndex < listings.length) {
      const savedListing = listings[currentIndex];
      setSavedListings((prev) => [...prev, savedListing]);
      setCurrentIndex((prev) => prev + 1);
      toast.success('Saved!', { description: `${savedListing.title} added to favorites` });
    }
  }, [currentIndex, listings]);

  const handleCardClick = (listing: Listing) => {
    navigate(`/listing/${listing.id}`, { state: { listing } });
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
    toast.success(`Searching for "${query}"`);
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

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      <Header onSearchClick={handleSearchClick} onFilterClick={handleFilterClick} />
      
      {/* Active Filters */}
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2 px-6 pb-2 flex-shrink-0">
          {filters.map((filter) => (
            <FilterChip key={filter} label={filter} onRemove={() => removeFilter(filter)} />
          ))}
        </div>
      )}
      
      {/* Card Stack - centered with space for fixed nav */}
      <div className="flex-1 flex items-center justify-center pb-24 min-h-0">
        <div className="relative w-full max-w-[340px] h-[68vh] max-h-[520px] px-5">
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
        listings={mockListings}
      />
      <BottomNav />
    </div>
  );
};

export default Index;
