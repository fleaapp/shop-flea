import { useState, useRef, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Plus, Search, X } from 'lucide-react';
import { useBrands, Brand } from '@/hooks/useBrands';
import { toast } from 'sonner';

interface BrandAutocompleteProps {
  value: string;
  onChange: (brandDisplayName: string) => void;
  className?: string;
  placeholder?: string;
}

const BrandAutocomplete = ({ value, onChange, className = '', placeholder = 'Brand' }: BrandAutocompleteProps) => {
  const { brands, loading, addBrand, searchBrands, findClosestMatch } = useBrands();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync query with external value
  useEffect(() => {
    if (value && !isOpen) {
      setQuery(value);
    }
  }, [value, isOpen]);

  const filteredBrands = useMemo(() => {
    return searchBrands(query);
  }, [query, searchBrands]);

  const showAddOption = useMemo(() => {
    if (!query.trim()) return false;
    const q = query.toLowerCase().trim();
    // Don't show if exact match exists
    return !brands.some(b => b.brand_name === q || b.display_name.toLowerCase() === q);
  }, [query, brands]);

  const closestMatch = useMemo(() => {
    if (!showAddOption || !query.trim()) return null;
    return findClosestMatch(query);
  }, [showAddOption, query, findClosestMatch]);

  const handleSelect = (brand: Brand) => {
    setQuery(brand.display_name);
    onChange(brand.display_name);
    setIsOpen(false);
    setHighlightIndex(-1);
  };

  const handleAddNew = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    if (closestMatch) {
      // Suggest closest match first
      const confirmed = window.confirm(
        `Did you mean "${closestMatch.display_name}"? Click OK to use it, or Cancel to create "${trimmed}" as a new brand.`
      );
      if (confirmed) {
        handleSelect(closestMatch);
        return;
      }
    }

    const newBrand = await addBrand(trimmed);
    if (newBrand) {
      setQuery(newBrand.display_name);
      onChange(newBrand.display_name);
      setIsOpen(false);
      toast.success(`Brand "${newBrand.display_name}" added!`);
    } else {
      toast.error('Failed to add brand');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    const totalItems = filteredBrands.length + (showAddOption ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < filteredBrands.length) {
        handleSelect(filteredBrands[highlightIndex]);
      } else if (highlightIndex === filteredBrands.length && showAddOption) {
        handleAddNew();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // If nothing was selected, reset to original value
        if (!value) setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-brand-item]');
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const handleClear = () => {
    setQuery('');
    onChange('');
    setIsOpen(true);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`pl-10 pr-10 ${className}`}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full hover:bg-muted"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-2xl border border-border bg-background shadow-lg"
        >
          {loading ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">Loading brands...</div>
          ) : (
            <>
              {filteredBrands.length === 0 && !showAddOption && (
                <div className="px-4 py-3 text-sm text-muted-foreground">No brands found</div>
              )}
              {filteredBrands.map((brand, index) => (
                <button
                  key={brand.id}
                  type="button"
                  data-brand-item
                  onClick={() => handleSelect(brand)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    highlightIndex === index
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  {brand.display_name}
                </button>
              ))}
              {showAddOption && (
                <>
                  {closestMatch && (
                    <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                      Did you mean "{closestMatch.display_name}"?
                    </div>
                  )}
                  <button
                    type="button"
                    data-brand-item
                    onClick={handleAddNew}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2 border-t border-border ${
                      highlightIndex === filteredBrands.length
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <Plus className="h-4 w-4" />
                    Add "{query.trim()}"
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default BrandAutocomplete;
