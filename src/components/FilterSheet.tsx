import { useState, useMemo } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FIT_OPTIONS,
  CATEGORY_OPTIONS,
  getSizesForFitAndCategory,
  CONDITIONS,
  COLOURS,
  STYLES,
} from '@/config/sizeConfig';

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyFilters: (filters: FilterState) => void;
  showHideSoldItems?: boolean;
}

export interface FilterState {
  preferences: boolean;
  hideSoldItems: boolean;
  fit: string;
  category: string;
  size: string;
  condition: string;
  colour: string;
  style: string;
  priceRange: [number, number];
}

const FilterSheet = ({ open, onOpenChange, onApplyFilters, showHideSoldItems = false }: FilterSheetProps) => {
  const [filters, setFilters] = useState<FilterState>({
    preferences: false,
    hideSoldItems: false,
    fit: '',
    category: '',
    size: '',
    condition: '',
    colour: '',
    style: '',
    priceRange: [0, 1000],
  });

  // Get available sizes based on fit and category
  const availableSizes = useMemo(() => {
    if (!filters.fit || !filters.category) return [];
    return getSizesForFitAndCategory(filters.fit, filters.category);
  }, [filters.fit, filters.category]);

  // Reset dependent fields when parent selection changes
  const handleFitChange = (value: string) => {
    setFilters(prev => ({ ...prev, fit: value, category: '', size: '' }));
  };

  const handleCategoryChange = (value: string) => {
    setFilters(prev => ({ ...prev, category: value, size: '' }));
  };

  const handleReset = () => {
    setFilters({
      preferences: false,
      hideSoldItems: false,
      fit: '',
      category: '',
      size: '',
      condition: '',
      colour: '',
      style: '',
      priceRange: [0, 1000],
    });
  };

  const handleApply = () => {
    onApplyFilters(filters);
    onOpenChange(false);
  };

  const ChipButton = ({ 
    label, 
    selected, 
    onClick 
  }: { 
    label: string; 
    selected: boolean; 
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        selected ? 'bg-primary text-foreground' : 'bg-card text-foreground'
      }`}
    >
      {label}
    </button>
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

          {/* Fit / Gender */}
          <div className="py-3">
            <label className="text-base font-medium mb-2 block">Fit / Gender</label>
            <Select value={filters.fit} onValueChange={handleFitChange}>
              <SelectTrigger className="w-full bg-card border-0 h-12 rounded-xl focus:ring-[#ddfed7]">
                <SelectValue placeholder="Select Fit" />
              </SelectTrigger>
              <SelectContent>
                {FIT_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category (depends on Fit) */}
          <div className="py-3">
            <label className="text-base font-medium mb-2 block">Category</label>
            <Select 
              value={filters.category} 
              onValueChange={handleCategoryChange}
              disabled={!filters.fit}
            >
              <SelectTrigger className="w-full bg-card border-0 h-12 rounded-xl focus:ring-[#ddfed7]">
                <SelectValue placeholder={filters.fit ? "Select Category" : "Select Fit first"} />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Size (depends on Fit + Category) */}
          <div className="py-3">
            <label className="text-base font-medium mb-2 block">Size</label>
            <Select 
              value={filters.size} 
              onValueChange={(val) => setFilters({ ...filters, size: val })}
              disabled={!filters.fit || !filters.category}
            >
              <SelectTrigger className="w-full bg-card border-0 h-12 rounded-xl focus:ring-[#ddfed7]">
                <SelectValue placeholder={!filters.fit ? "Select Fit first" : !filters.category ? "Select Category first" : "Select Size"} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {availableSizes.map((s) => (
                  <SelectItem key={s} value={s.toLowerCase()}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Condition */}
          <div className="py-3">
            <label className="text-base font-medium mb-3 block">Condition</label>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((option) => (
                <ChipButton
                  key={option}
                  label={option}
                  selected={filters.condition === option}
                  onClick={() => setFilters({ ...filters, condition: option })}
                />
              ))}
            </div>
          </div>

          {/* Colour */}
          <div className="py-3">
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
          <div className="py-3">
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
          <div className="py-3">
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
