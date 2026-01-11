import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, X, Clock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface SearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (query: string) => void;
}

const searchSuggestions = [
  'cardigan', 'skirt', 'shorts', 'sneakers', 'jeans', 'shirt', 'jacket', 'sweater'
];

const userSuggestions = [
  { username: 'redsparrow', avatar: '' },
  { username: 'reddog', avatar: '' },
  { username: 'red123', avatar: '' },
];

const SearchSheet = ({ open, onOpenChange, onSearch }: SearchSheetProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem('recentSearches');
    return saved ? JSON.parse(saved) : ['Red cardigan', 'Wide leg jeans', 'Blue t-shirt', 'Mini dress'];
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

  const filteredSuggestions = query
    ? searchSuggestions.filter(s => 
        s.toLowerCase().includes(query.toLowerCase()) || 
        query.toLowerCase().includes(s.toLowerCase().split(' ')[0])
      )
    : [];

  const filteredUsers = query
    ? userSuggestions.filter(u => u.username.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          // Avoid the browser scrolling the sheet when focusing (common on mobile)
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
                className="pl-12 pr-12 h-12 bg-card border-0 rounded-xl text-base"
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
                {/* Item suggestions */}
                {filteredSuggestions.length > 0 || query ? (
                  <div className="space-y-3">
                    {(filteredSuggestions.length > 0 ? filteredSuggestions : searchSuggestions).map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => handleSearch(`${query} ${suggestion}`)}
                        className="block w-full text-left py-1"
                      >
                        <span className="font-semibold text-foreground">{query}</span>
                        <span className="text-muted-foreground"> {suggestion}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {/* User suggestions */}
                {filteredUsers.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.username}
                        onClick={() => handleSearch(`@${user.username}`)}
                        className="flex items-center gap-3 w-full text-left py-1"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar} />
                          <AvatarFallback className="bg-muted text-xs">
                            {user.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-foreground">@{user.username}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Show users even without specific filter when query exists */}
                {query && filteredUsers.length === 0 && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    {userSuggestions.map((user) => (
                      <button
                        key={user.username}
                        onClick={() => handleSearch(`@${user.username}`)}
                        className="flex items-center gap-3 w-full text-left py-1"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar} />
                          <AvatarFallback className="bg-muted text-xs">
                            {user.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-foreground">@{user.username}</span>
                      </button>
                    ))}
                  </div>
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
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SearchSheet;
