import { useState } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, X } from 'lucide-react';
import { FILTER_SIZES, CONDITIONS, COLOURS, STYLES, CATEGORY_OPTIONS } from '@/config/sizeConfig';

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyFilters: (filters: FilterState) => void;
  showHideSoldItems?: boolean;
}

export interface FilterState {
  preferences: boolean;
  hideSoldItems: boolean;
  sizes: string[]; // Multi-select sizes
  categories: string[]; // Multi-select categories
  condition: string;
  colour: string;
  style: string;
  priceRange: [number, number];
}

const FilterSheet = ({ open, onOpenChange, onApplyFilters, showHideSoldItems = false }: FilterSheetProps) => {
  const [filters, setFilters] = useState<FilterState>({
    preferences: false,
    hideSoldItems: false,
    sizes: [],
    categories: [],
    condition: '',
    colour: '',
    style: '',
    priceRange: [0, 1000],
  });

  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    categories: false,
    women: false,
    men: false,
    unisex: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleSize = (size: string) => {
    const normalizedSize = size.toLowerCase();
    setFilters(prev => ({
      ...prev,
      sizes: prev.sizes.includes(normalizedSize)
        ? prev.sizes.filter(s => s !== normalizedSize)
        : [...prev.sizes, normalizedSize],
    }));
  };

  const toggleCategory = (category: string) => {
    const normalizedCat = category.toLowerCase();
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(normalizedCat)
        ? prev.categories.filter(c => c !== normalizedCat)
        : [...prev.categories, normalizedCat],
    }));
  };

  const clearAllSizes = () => {
    setFilters(prev => ({ ...prev, sizes: [] }));
  };

  const clearAllCategories = () => {
    setFilters(prev => ({ ...prev, categories: [] }));
  };

  const handleReset = () => {
    setFilters({
      preferences: false,
      hideSoldItems: false,
      sizes: [],
      categories: [],
      condition: '',
      colour: '',
      style: '',
      priceRange: [0, 1000],
    });
    setExpandedSections({ categories: false, women: false, men: false, unisex: false });
  };

  const handleApply = () => {
    onApplyFilters(filters);
    onOpenChange(false);
  };

  const SizeChip = ({ size, selected }: { size: string; selected: boolean }) => (
    <button
      type="button"
      onClick={() => toggleSize(size)}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        selected ? 'bg-primary text-foreground' : 'bg-muted text-foreground hover:bg-muted/80'
      }`}
    >
      {size}
    </button>
  );

  const SectionHeader = ({ label, section }: { label: string; section: string }) => (
    <CollapsibleTrigger className="flex items-center justify-between w-full py-3 text-left">
      <span className="font-medium">{label}</span>
      <ChevronDown
        className={`h-5 w-5 text-muted-foreground transition-transform ${
          expandedSections[section] ? 'rotate-180' : ''
        }`}
      />
    </CollapsibleTrigger>
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] rounded-t-3xl border-0 bg-background">
        <div className="px-6 pb-4 flex-shrink-0">
          <h2 className="text-center text-xl font-semibold">Filter</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-28" style={{ overscrollBehavior: 'contain' }}>
          {/* Hide Sold Items Toggle - Only shown on Wishlist */}
          {showHideSoldItems && (
            <div className="flex items-center justify-between py-4">
              <span className="text-lg font-medium">Hide sold items</span>
              <Switch
                checked={filters.hideSoldItems}
                onCheckedChange={(checked) => setFilters({ ...filters, hideSoldItems: checked })}
                className="data-[state=checked]:bg-charcoal data-[state=unchecked]:bg-input [&>span]:data-[state=checked]:bg-primary [&>span]:data-[state=unchecked]:bg-charcoal"
              />
            </div>
          )}

          {/* Preferences Toggle */}
          <div className={`flex items-center justify-between py-4 ${showHideSoldItems ? 'border-t border-border' : ''}`}>
            <span className="text-lg font-medium">Preferences</span>
            <Switch
              checked={filters.preferences}
              onCheckedChange={(checked) => setFilters({ ...filters, preferences: checked })}
              className="data-[state=checked]:bg-charcoal data-[state=unchecked]:bg-input [&>span]:data-[state=checked]:bg-primary [&>span]:data-[state=unchecked]:bg-charcoal"
            />
          </div>

          {/* Categories Section */}
          <div className="py-3 border-t border-border">
            <Collapsible open={expandedSections.categories} onOpenChange={() => toggleSection('categories')}>
              <div className="flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center justify-between flex-1 py-2 text-left">
                  <span className="text-lg font-medium">Categories</span>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      expandedSections.categories ? 'rotate-180' : ''
                    }`}
                  />
                </CollapsibleTrigger>
                {filters.categories.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllCategories}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 ml-2"
                  >
                    Clear ({filters.categories.length})
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <CollapsibleContent className="pb-3">
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {CATEGORY_OPTIONS.map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => toggleCategory(cat.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        filters.categories.includes(cat.value.toLowerCase())
                          ? 'bg-primary text-foreground'
                          : 'bg-muted text-foreground hover:bg-muted/80'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Sizes Section with Accordion */}
          <div className="py-3 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <label className="text-lg font-medium">Sizes</label>
              {filters.sizes.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllSizes}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  Clear ({filters.sizes.length})
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            
            {/* Women's Section */}
            <Collapsible open={expandedSections.women} onOpenChange={() => toggleSection('women')}>
              <SectionHeader label="Women's" section="women" />
              <CollapsibleContent className="pb-3">
                <div className="space-y-3 pl-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Clothing (inches)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FILTER_SIZES.women.clothing.inches.map(size => (
                        <SizeChip key={size} size={size} selected={filters.sizes.includes(size.toLowerCase())} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Clothing (alpha)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FILTER_SIZES.women.clothing.alpha.map(size => (
                        <SizeChip key={size} size={size} selected={filters.sizes.includes(size.toLowerCase())} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Shoes (AU)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FILTER_SIZES.women.shoes.map(size => (
                        <SizeChip key={size} size={size} selected={filters.sizes.includes(size.toLowerCase())} />
                      ))}
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Men's Section */}
            <Collapsible open={expandedSections.men} onOpenChange={() => toggleSection('men')}>
              <SectionHeader label="Men's" section="men" />
              <CollapsibleContent className="pb-3">
                <div className="space-y-3 pl-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Clothing (inches)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FILTER_SIZES.men.clothing.inches.map(size => (
                        <SizeChip key={size} size={size} selected={filters.sizes.includes(size.toLowerCase())} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Clothing (alpha)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FILTER_SIZES.men.clothing.alpha.map(size => (
                        <SizeChip key={size} size={size} selected={filters.sizes.includes(size.toLowerCase())} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Shoes (AU)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FILTER_SIZES.men.shoes.map(size => (
                        <SizeChip key={size} size={size} selected={filters.sizes.includes(size.toLowerCase())} />
                      ))}
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Unisex Section */}
            <Collapsible open={expandedSections.unisex} onOpenChange={() => toggleSection('unisex')}>
              <SectionHeader label="Unisex" section="unisex" />
              <CollapsibleContent className="pb-3">
                <div className="space-y-3 pl-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Clothing (inches)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FILTER_SIZES.unisex.clothing.inches.map(size => (
                        <SizeChip key={size} size={size} selected={filters.sizes.includes(size.toLowerCase())} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Clothing (alpha)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FILTER_SIZES.unisex.clothing.alpha.map(size => (
                        <SizeChip key={size} size={size} selected={filters.sizes.includes(size.toLowerCase())} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Shoes (AU)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FILTER_SIZES.unisex.shoes.map(size => (
                        <SizeChip key={size} size={size} selected={filters.sizes.includes(size.toLowerCase())} />
                      ))}
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Condition */}
          <div className="py-3 border-t border-border">
            <label className="text-base font-medium mb-3 block">Condition</label>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilters({ ...filters, condition: filters.condition === option ? '' : option })}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filters.condition === option ? 'bg-primary text-foreground' : 'bg-muted text-foreground'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Colour */}
          <div className="py-3 border-t border-border">
            <label className="text-base font-medium mb-2 block">Colour</label>
            <Select value={filters.colour} onValueChange={(val) => setFilters({ ...filters, colour: val })}>
              <SelectTrigger className="w-full bg-card border-0 h-12 rounded-xl focus:ring-[#ddfed7]">
                <SelectValue placeholder="Select Colour" />
              </SelectTrigger>
              <SelectContent>
                {COLOURS.map((c) => (
                  <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Style */}
          <div className="py-3 border-t border-border">
            <label className="text-base font-medium mb-2 block">Style</label>
            <Select value={filters.style} onValueChange={(val) => setFilters({ ...filters, style: val })}>
              <SelectTrigger className="w-full bg-card border-0 h-12 rounded-xl focus:ring-[#ddfed7]">
                <SelectValue placeholder="Select Style" />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s} value={s.toLowerCase()}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price */}
          <div className="py-3 border-t border-border">
            <label className="text-base font-medium mb-2 block">Price</label>
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Minimum</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={filters.priceRange[0] || ''}
                    onChange={(e) => setFilters({ ...filters, priceRange: [Number(e.target.value) || 0, filters.priceRange[1]] })}
                    className="pl-7 bg-card border-0 h-12 rounded-xl focus-visible:ring-[#ddfed7]"
                    placeholder="0"
                    min={0}
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Maximum</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={filters.priceRange[1] || ''}
                    onChange={(e) => setFilters({ ...filters, priceRange: [filters.priceRange[0], Number(e.target.value) || 0] })}
                    className="pl-7 bg-card border-0 h-12 rounded-xl focus-visible:ring-[#ddfed7]"
                    placeholder="1000"
                    min={0}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Buttons */}
        <div className="p-6 bg-background border-t border-border flex gap-4">
          <Button
            variant="outline"
            onClick={handleReset}
            className="flex-1 h-12 rounded-xl bg-muted text-foreground border-0 font-medium"
          >
            Reset
          </Button>
          <Button
            onClick={handleApply}
            className="flex-1 h-12 rounded-xl bg-charcoal text-card font-medium"
          >
            Show Results
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default FilterSheet;
