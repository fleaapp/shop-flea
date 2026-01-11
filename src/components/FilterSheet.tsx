import { useState } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyFilters: (filters: FilterState) => void;
}

export interface FilterState {
  preferences: boolean;
  category: string;
  size: string;
  condition: string;
  gender: string;
  colour: string;
  style: string;
  priceRange: [number, number];
}

const conditionOptions = ['Fair', 'Good', 'Excellent', 'New'];
const genderOptions = ['Female', 'Male', 'Unisex'];

const FilterSheet = ({ open, onOpenChange, onApplyFilters }: FilterSheetProps) => {
  const [filters, setFilters] = useState<FilterState>({
    preferences: true,
    category: '',
    size: '',
    condition: 'Excellent',
    gender: 'Female',
    colour: '',
    style: '',
    priceRange: [0, 67],
  });

  const handleReset = () => {
    setFilters({
      preferences: false,
      category: '',
      size: '',
      condition: '',
      gender: '',
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
        selected 
          ? 'bg-filter-chip text-foreground' 
          : 'bg-card text-foreground'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] rounded-t-3xl bg-background">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
        </div>
        
        <div className="px-6 pb-4 flex-shrink-0">
          <h2 className="text-center text-xl font-semibold">Filter</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-28" style={{ overscrollBehavior: 'contain' }}>
          {/* Preferences Toggle */}
          <div className="flex items-center justify-between py-4">
            <span className="text-lg font-medium">Preferences</span>
            <Switch
              checked={filters.preferences}
              onCheckedChange={(checked) => setFilters({ ...filters, preferences: checked })}
            />
          </div>

          {/* Category */}
          <div className="py-3">
            <label className="text-base font-medium mb-2 block">Category</label>
            <Select value={filters.category} onValueChange={(val) => setFilters({ ...filters, category: val })}>
              <SelectTrigger className="w-full bg-card border-0 h-12 rounded-xl">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tops">Tops</SelectItem>
                <SelectItem value="bottoms">Bottoms</SelectItem>
                <SelectItem value="dresses">Dresses</SelectItem>
                <SelectItem value="outerwear">Outerwear</SelectItem>
                <SelectItem value="shoes">Shoes</SelectItem>
                <SelectItem value="accessories">Accessories</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Size */}
          <div className="py-3">
            <label className="text-base font-medium mb-2 block">Size</label>
            <Select value={filters.size} onValueChange={(val) => setFilters({ ...filters, size: val })}>
              <SelectTrigger className="w-full bg-card border-0 h-12 rounded-xl">
                <SelectValue placeholder="Select Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xs">XS</SelectItem>
                <SelectItem value="s">S</SelectItem>
                <SelectItem value="m">M</SelectItem>
                <SelectItem value="l">L</SelectItem>
                <SelectItem value="xl">XL</SelectItem>
                <SelectItem value="xxl">XXL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Condition */}
          <div className="py-3">
            <label className="text-base font-medium mb-3 block">Condition</label>
            <div className="flex flex-wrap gap-2">
              {conditionOptions.map((option) => (
                <ChipButton
                  key={option}
                  label={option}
                  selected={filters.condition === option}
                  onClick={() => setFilters({ ...filters, condition: option })}
                />
              ))}
            </div>
          </div>

          {/* Gender */}
          <div className="py-3">
            <label className="text-base font-medium mb-3 block">Gender</label>
            <div className="flex flex-wrap gap-2">
              {genderOptions.map((option) => (
                <ChipButton
                  key={option}
                  label={option}
                  selected={filters.gender === option}
                  onClick={() => setFilters({ ...filters, gender: option })}
                />
              ))}
            </div>
          </div>

          {/* Colour */}
          <div className="py-3">
            <label className="text-base font-medium mb-2 block">Colour</label>
            <Select value={filters.colour} onValueChange={(val) => setFilters({ ...filters, colour: val })}>
              <SelectTrigger className="w-full bg-card border-0 h-12 rounded-xl">
                <SelectValue placeholder="Select Colour" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="black">Black</SelectItem>
                <SelectItem value="white">White</SelectItem>
                <SelectItem value="grey">Grey</SelectItem>
                <SelectItem value="navy">Navy</SelectItem>
                <SelectItem value="brown">Brown</SelectItem>
                <SelectItem value="beige">Beige</SelectItem>
                <SelectItem value="pink">Pink</SelectItem>
                <SelectItem value="red">Red</SelectItem>
                <SelectItem value="blue">Blue</SelectItem>
                <SelectItem value="green">Green</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Style */}
          <div className="py-3">
            <label className="text-base font-medium mb-2 block">Style</label>
            <Select value={filters.style} onValueChange={(val) => setFilters({ ...filters, style: val })}>
              <SelectTrigger className="w-full bg-card border-0 h-12 rounded-xl">
                <SelectValue placeholder="Select Style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="streetwear">Streetwear</SelectItem>
                <SelectItem value="vintage">Vintage</SelectItem>
                <SelectItem value="minimalist">Minimalist</SelectItem>
                <SelectItem value="bohemian">Bohemian</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Price */}
          <div className="py-3">
            <label className="text-base font-medium mb-4 block">Price</label>
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>$0</span>
              <span>${filters.priceRange[1]}</span>
              <span>$1K+</span>
            </div>
            <Slider
              value={filters.priceRange}
              onValueChange={(val) => setFilters({ ...filters, priceRange: val as [number, number] })}
              max={1000}
              min={0}
              step={1}
              className="w-full"
            />
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
