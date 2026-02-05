import { useState, useEffect, useRef, useMemo } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { ArrowLeft, X, Clock } from 'lucide-react';
import { Listing } from '@/types/listing';
import { useAuth } from '@/context/AuthContext';

interface SearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (query: string) => void;
  listings: Listing[];
}

const SearchSheet = ({ open, onOpenChange, onSearch, listings }: SearchSheetProps) => {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // User-specific localStorage key for recent searches
  const storageKey = user ? `recentSearches_${user.id}` : null;

  // Load recent searches when user changes or component mounts
  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      setRecentSearches(saved ? JSON.parse(saved) : []);
    } else {
      setRecentSearches([]);
    }
  }, [storageKey]);

  // Save recent searches when they change
  useEffect(() => {
    if (storageKey && recentSearches.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(recentSearches));
    }
  }, [recentSearches, storageKey]);

  // Extract searchable terms from listings
  const searchableTerms = useMemo(() => {
    const terms = new Set<string>();
    
    listings.forEach(listing => {
      // Add title words (split and clean)
      listing.title.split(/\s+/).forEach(word => {
        const cleaned = word.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleaned.length > 2) terms.add(cleaned);
      });
      
      // Add full title as a term
      terms.add(listing.title.toLowerCase());
      
      // Add category
      if (listing.category) {
        terms.add(listing.category.toLowerCase());
      }
      
      // Add brand
      if (listing.brand) {
        terms.add(listing.brand.toLowerCase());
      }
      
      // Add tags
      listing.tags?.forEach(tag => {
        terms.add(tag.toLowerCase());
      });
    });
    
    return Array.from(terms);
  }, [listings]);

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

  // Generate search suggestions based on query
  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    
    const lowerQuery = query.toLowerCase().trim();
    const results: string[] = [];
    const seen = new Set<string>();
    
    // Find matching listing titles (prioritize these)
    listings.forEach(listing => {
      const titleLower = listing.title.toLowerCase();
      if (titleLower.includes(lowerQuery) && !seen.has(titleLower)) {
        seen.add(titleLower);
        results.push(listing.title);
      }
    });
    
    // Find matching categories
    const categories = [...new Set(listings.map(l => l.category))];
    categories.forEach(cat => {
      const catLower = cat.toLowerCase();
      if (catLower.includes(lowerQuery) && !seen.has(catLower)) {
        seen.add(catLower);
        results.push(cat.charAt(0).toUpperCase() + cat.slice(1));
      }
    });
    
    // Find matching brands
    const brands = [...new Set(listings.map(l => l.brand).filter(Boolean))];
    brands.forEach(brand => {
      const brandLower = brand.toLowerCase();
      if (brandLower.includes(lowerQuery) && !seen.has(brandLower)) {
        seen.add(brandLower);
        results.push(brand);
      }
    });
    
    // Find matching tags
    const allTags = [...new Set(listings.flatMap(l => l.tags || []))];
    allTags.forEach(tag => {
      const tagLower = tag.toLowerCase();
      if (tagLower.includes(lowerQuery) && !seen.has(tagLower)) {
        seen.add(tagLower);
        results.push(tag.charAt(0).toUpperCase() + tag.slice(1));
      }
    });
    
    // Find partial word matches from searchable terms
    searchableTerms.forEach(term => {
      if (term.startsWith(lowerQuery) && !seen.has(term) && term !== lowerQuery) {
        seen.add(term);
        results.push(term.charAt(0).toUpperCase() + term.slice(1));
      }
    });
    
    return results.slice(0, 8);
  }, [query, listings, searchableTerms]);

  // Helper to render suggestion with query highlighted
  const renderSuggestion = (suggestion: string) => {
    const lowerSuggestion = suggestion.toLowerCase();
    const lowerQuery = query.toLowerCase().trim();
    const index = lowerSuggestion.indexOf(lowerQuery);
    
    if (index === -1) {
      return <span className="text-muted-foreground">{suggestion}</span>;
    }
    
    const before = suggestion.slice(0, index);
    const match = suggestion.slice(index, index + query.trim().length);
    const after = suggestion.slice(index + query.trim().length);
    
    return (
      <>
        {before && <span className="text-muted-foreground">{before}</span>}
        <span className="text-foreground font-semibold">{match}</span>
        {after && <span className="text-muted-foreground">{after}</span>}
      </>
    );
  };

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
              <span className="text-lg">🔍</span>
              <span className="text-lg font-semibold">Search</span>
            </div>
          </div>

          {/* Search Input */}
          <div className="px-6 pb-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🔍</span>
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
                placeholder="Search..."
                className="pl-12 pr-12 h-12 bg-card border border-muted-foreground/30 rounded-xl text-base focus-visible:ring-muted-foreground/50"
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
          {/* Search Suggestions */}
          {query && suggestions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-foreground mb-3">Search results</h3>
              <div className="bg-card rounded-2xl p-4">
                <div className="space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion}-${index}`}
                      onClick={() => handleSearch(suggestion)}
                      className="block w-full text-left py-2.5"
                    >
                      {renderSuggestion(suggestion)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* No suggestions message */}
          {query && suggestions.length === 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-foreground mb-3">Search results</h3>
              <div className="bg-card rounded-2xl p-4">
                <p className="text-muted-foreground text-sm py-2">No suggestions for "{query}"</p>
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
              <span className="text-5xl opacity-50 mb-4">🔍</span>
              <p className="text-muted-foreground">Start typing to search listings</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SearchSheet;
