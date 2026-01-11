import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, X, Clock } from 'lucide-react';
import { Listing } from '@/types/listing';

interface SearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (query: string) => void;
  listings: Listing[];
}

const SearchSheet = ({ open, onOpenChange, onSearch, listings }: SearchSheetProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem('recentSearches');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
  }, [recentSearches]);

  const handleSearch = (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    
    // Add to recent searches (avoid duplicates, keep max 10)
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== searchTerm.toLowerCase());
      return [searchTerm, ...filtered].slice(0, 10);
    });
    
    onSearch(searchTerm);
    onOpenChange(false);
    setQuery('');
  };

  const handleRemoveRecent = (searchTerm: string) => {
    setRecentSearches(prev => prev.filter(s => s !== searchTerm));
  };

  const clearQuery = () => setQuery('');

  // Filter listings based on query
  const filteredListings = query
    ? listings.filter(listing => 
        listing.title.toLowerCase().includes(query.toLowerCase()) ||
        listing.category.toLowerCase().includes(query.toLowerCase()) ||
        listing.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      )
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus({ preventScroll: true });
        }}
        className="!inset-0 h-[100dvh] max-h-[100dvh] rounded-none bg-background p-0 flex flex-col overflow-hidden"
      >
        {/* Top (always visible) */}
        <div className="shrink-0 bg-background pt-[env(safe-area-inset-top,12px)]">
          {/* Header */}
          <div className="flex items-center gap-4 px-6 py-4">
            <button onClick={() => onOpenChange(false)} className="p-1">
              <ArrowLeft className="h-6 w-6 text-foreground" />
            </button>
            <div className="flex items-center gap-2 flex-1 justify-center -ml-7">
              <Search className="h-5 w-5 text-foreground" />
              <span className="text-lg font-semibold">Search</span>
            </div>
          </div>

          {/* Search Input */}
          <div className="px-6 pb-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
                placeholder="Search..."
                className="pl-12 pr-12 h-12 bg-card border border-border rounded-xl text-base"
              />
              {query && (
                <button
                  onClick={clearQuery}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full bg-muted"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scroll area */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] [-webkit-overflow-scrolling:touch]">
          {/* Search Results */}
          {query && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-foreground mb-3">Search results</h3>
              <div className="bg-card rounded-2xl p-4">
                {filteredListings.length > 0 ? (
                  <div className="space-y-3">
                    {filteredListings.slice(0, 8).map((listing) => (
                      <button
                        key={listing.id}
                        onClick={() => handleSearch(listing.title)}
                        className="block w-full text-left py-2"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={listing.image}
                            alt={listing.title}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                          <div>
                            <span className="font-medium text-foreground">{listing.title}</span>
                            <p className="text-sm text-muted-foreground">${listing.price}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm py-2">No results found for "{query}"</p>
                )}
              </div>
            </div>
          )}

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">Recent searches</h3>
              <div className="bg-card rounded-2xl p-4 space-y-1">
                {recentSearches.map((search) => (
                  <div
                    key={search}
                    className="flex items-center justify-between py-2"
                  >
                    <button
                      onClick={() => handleSearch(search)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <span className="text-foreground font-medium">{search}</span>
                    </button>
                    <button
                      onClick={() => handleRemoveRecent(search)}
                      className="p-1"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state when no recent searches and no query */}
          {!query && recentSearches.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Start typing to search listings</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SearchSheet;
