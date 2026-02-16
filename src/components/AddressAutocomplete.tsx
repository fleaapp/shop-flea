import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AddressSuggestion {
  full_address: string;
  address_line_1: string;
  locality_name: string;
  state_abbreviation: string;
  postcode: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: {
    street: string;
    city: string;
    state: string;
    postcode: string;
  }) => void;
  placeholder?: string;
  className?: string;
}

const AddressAutocomplete = ({
  value,
  onChange,
  onSelect,
  placeholder = 'Start typing your address...',
  className,
}: AddressAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      // Using the free Australian address API from addressfinder alternative
      const response = await fetch(
        `https://api.addressfinder.io/api/au/address/autocomplete/?q=${encodeURIComponent(query)}&format=json&key=DEMO_KEY`
      );
      
      if (!response.ok) {
        // Fallback: use a simple fuzzy approach with Australia Post data
        // For now, we'll use a free geocoding service
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Australia')}&format=json&addressdetails=1&countrycodes=au&limit=5`
        );
        
        if (geoResponse.ok) {
          const data = await geoResponse.json();
          const mapped: AddressSuggestion[] = data
            .filter((item: any) => item.address)
            .map((item: any) => {
              const addr = item.address;
              const houseNumber = addr.house_number || '';
              const road = addr.road || '';
              const street = [houseNumber, road].filter(Boolean).join(' ');
              const city = addr.city || addr.town || addr.suburb || addr.village || '';
              const state = addr.state || '';
              const postcode = addr.postcode || '';

              // Map full state names to abbreviations
              const stateMap: Record<string, string> = {
                'New South Wales': 'NSW',
                'Victoria': 'VIC',
                'Queensland': 'QLD',
                'Western Australia': 'WA',
                'South Australia': 'SA',
                'Tasmania': 'TAS',
                'Australian Capital Territory': 'ACT',
                'Northern Territory': 'NT',
              };

              return {
                full_address: item.display_name,
                address_line_1: street,
                locality_name: city,
                state_abbreviation: stateMap[state] || state,
                postcode,
              };
            });
          setSuggestions(mapped);
        }
        return;
      }

      const data = await response.json();
      if (data.completions) {
        setSuggestions(data.completions.slice(0, 5));
      }
    } catch (error) {
      console.warn('Address autocomplete error:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    setShowSuggestions(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 350);
  };

  const handleSelect = (suggestion: AddressSuggestion) => {
    onSelect({
      street: suggestion.address_line_1,
      city: suggestion.locality_name,
      state: suggestion.state_abbreviation,
      postcode: suggestion.postcode,
    });
    setShowSuggestions(false);
    setSuggestions([]);
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        className={cn('h-11 rounded-xl bg-background border-border', className)}
        placeholder={placeholder}
        autoComplete="off"
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl bg-card border border-border shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted active:bg-muted/70 transition-colors border-b border-border last:border-b-0"
              onClick={() => handleSelect(s)}
            >
              <span className="text-foreground line-clamp-2">{s.full_address}</span>
            </button>
          ))}
        </div>
      )}

      {isLoading && value.length >= 3 && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
