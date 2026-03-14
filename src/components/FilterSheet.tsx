import { useEffect, useState } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, X } from 'lucide-react';
import { FILTER_SIZES, CONDITIONS, COLOURS, STYLES, CATEGORY_OPTIONS, FIT_OPTIONS } from '@/config/sizeConfig';
import { formatSizeKeyLabel, makeSizeKey, normalizeSizeKeys, SizeCategoryKey, FitKey } from '@/utils/sizeKeys';

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyFilters: (filters: FilterState) => void;
  showHideSoldItems?: boolean;
  preferredSizes?: string[] | null;
}

export interface FilterState {
  preferences: boolean;
  hideSoldItems: boolean;
  sizes: string[]; // Multi-select sizes
  categories: string[]; // Multi-select categories (includes subcategories)
  genders: string[]; // Multi-select Gender/Fit filter
  condition: string;
  colours: string[]; // Multi-select colours
  styles: string[]; // Multi-select styles
  priceRange: [number, number];
}

import { COLOUR_SWATCHES } from '@/utils/colourSwatches';

const FilterSheet = ({ open, onOpenChange, onApplyFilters, showHideSoldItems = false, preferredSizes }: FilterSheetProps) => {
  const [filters, setFilters] = useState<FilterState>({
    preferences: false,
    hideSoldItems: false,
    sizes: [],
    categories: [],
    genders: [],
    condition: '',
    colours: [],
    styles: [],
    priceRange: [0, 1000],
  });

  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    categories: false,
    sizes: false,
    women: false,
    men: false,
    unisex: false,
    kids: false,
    colours: false,
    styles: false,
  });

  // Track expanded category sections
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleCategorySection = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const toggleSize = (size: string, category: SizeCategoryKey, fit: FitKey) => {
    const key = makeSizeKey(fit, category, size);
    setFilters(prev => ({
      ...prev,
      sizes: prev.sizes.includes(key)
        ? prev.sizes.filter(s => s !== key)
        : [...prev.sizes, key],
    }));
  };

  const toggleSizeKey = (key: string) => {
    const normalized = key.toLowerCase();
    setFilters(prev => ({
      ...prev,
      sizes: prev.sizes.includes(normalized)
        ? prev.sizes.filter(s => s !== normalized)
        : [...prev.sizes, normalized],
    }));
  };

  // When Preferences is enabled, keep sizes synced to saved preferences.
  useEffect(() => {
    if (!open) return;
    if (!filters.preferences) return;
    setFilters(prev => ({
      ...prev,
      sizes: normalizeSizeKeys(preferredSizes),
    }));
  }, [open, filters.preferences, preferredSizes]);

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

  const toggleColour = (colour: string) => {
    const normalizedColour = colour.toLowerCase();
    setFilters(prev => ({
      ...prev,
      colours: prev.colours.includes(normalizedColour)
        ? prev.colours.filter(c => c !== normalizedColour)
        : [...prev.colours, normalizedColour],
    }));
  };

  const toggleStyle = (style: string) => {
    const normalizedStyle = style.toLowerCase();
    setFilters(prev => ({
      ...prev,
      styles: prev.styles.includes(normalizedStyle)
        ? prev.styles.filter(s => s !== normalizedStyle)
        : [...prev.styles, normalizedStyle],
    }));
  };

  const clearAllColours = () => {
    setFilters(prev => ({ ...prev, colours: [] }));
  };

  const clearAllStyles = () => {
    setFilters(prev => ({ ...prev, styles: [] }));
  };

  const toggleGender = (value: string) => {
    setFilters(prev => ({
      ...prev,
      genders: prev.genders.includes(value)
        ? prev.genders.filter(g => g !== value)
        : [...prev.genders, value],
    }));
  };

  const handleReset = () => {
    setFilters({
      preferences: false,
      hideSoldItems: false,
      sizes: [],
      categories: [],
      genders: [],
      condition: '',
      colours: [],
      styles: [],
      priceRange: [0, 1000],
    });
    setExpandedSections({ categories: false, sizes: false, women: false, men: false, unisex: false, kids: false, colours: false, styles: false });
    setExpandedCategories({});
  };

  const handleApply = () => {
    onApplyFilters(filters);
    onOpenChange(false);
  };

  const SizeChip = ({ size, selected, category, fit }: { size: string; selected: boolean; category: SizeCategoryKey; fit: FitKey }) => (
    <button
      type="button"
      onClick={() => toggleSize(size, category, fit)}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        selected ? 'bg-primary text-foreground' : 'bg-muted text-foreground hover:bg-muted/80'
      }`}
    >
      {size}
    </button>
  );

  const CategoryChip = ({ category, selected }: { category: string; label: string; selected: boolean }) => (
    <button
      type="button"
      onClick={() => toggleCategory(category)}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        selected ? 'bg-primary text-foreground' : 'bg-muted text-foreground hover:bg-muted/80'
      }`}
    >
      {category === category.toLowerCase() ? category.charAt(0).toUpperCase() + category.slice(1) : category}
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
      <DrawerContent className="max-h-[90dvh] rounded-t-3xl border-0 bg-background">
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
              onCheckedChange={(checked) => {
                setFilters(prev => ({
                  ...prev,
                  preferences: checked,
                  sizes: checked ? normalizeSizeKeys(preferredSizes) : prev.sizes,
                }));
              }}
              className="data-[state=checked]:bg-charcoal data-[state=unchecked]:bg-input [&>span]:data-[state=checked]:bg-primary [&>span]:data-[state=unchecked]:bg-charcoal"
            />
          </div>

          {/* Gender/Fit Section - Multi-select */}
          <div className="py-3 border-t border-border">
            <label className="text-lg font-medium mb-3 block">Fit</label>
            <div className="flex flex-wrap gap-2">
              {FIT_OPTIONS.map((fit) => (
                <button
                  key={fit.value}
                  type="button"
                  onClick={() => toggleGender(fit.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filters.genders.includes(fit.value) ? 'bg-primary text-foreground' : 'bg-muted text-foreground'
                  }`}
                >
                  {fit.label}
                </button>
              ))}
            </div>
          </div>

          {/* Categories Section - Now with subcategories */}
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
                <div className="space-y-2 pt-2">
                  {CATEGORY_OPTIONS.map(cat => {
                    const hasSubcats = cat.subcategories && cat.subcategories.length > 0;
                    const isExpanded = expandedCategories[cat.value];
                    const mainSelected = filters.categories.includes(cat.value.toLowerCase());

                    return (
                      <div key={cat.value}>
                        {hasSubcats ? (
                          <Collapsible open={isExpanded} onOpenChange={() => toggleCategorySection(cat.value)}>
                            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-left">
                              <span className="text-sm font-medium">{cat.label}</span>
                              <ChevronDown
                                className={`h-4 w-4 text-muted-foreground transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pb-2 pl-2">
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {/* Main category as first bubble */}
                                <button
                                  type="button"
                                  onClick={() => toggleCategory(cat.value)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                    mainSelected
                                      ? 'bg-primary text-foreground'
                                      : 'bg-muted text-foreground hover:bg-muted/80'
                                  }`}
                                >
                                  All {cat.label}
                                </button>
                                {/* Subcategories */}
                                {cat.subcategories.map(subcat => {
                                  const subSelected = filters.categories.includes(subcat.value.toLowerCase());
                                  return (
                                    <button
                                      key={subcat.value}
                                      type="button"
                                      onClick={() => toggleCategory(subcat.value)}
                                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                        subSelected
                                          ? 'bg-primary text-foreground'
                                          : 'bg-muted text-foreground hover:bg-muted/80'
                                      }`}
                                    >
                                      {subcat.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleCategory(cat.value)}
                            className={`transition-colors ${
                              mainSelected 
                                ? 'px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-foreground'
                                : 'block w-full py-2 text-left text-sm font-medium'
                            }`}
                          >
                            {cat.label}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Sizes Section with Gender Dropdown */}
          <div className="py-3 border-t border-border">
            <Collapsible open={expandedSections.sizes} onOpenChange={() => toggleSection('sizes')}>
              <div className="flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center justify-between flex-1 py-2 text-left">
                  <span className="text-lg font-medium">Sizes</span>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      expandedSections.sizes ? 'rotate-180' : ''
                    }`}
                  />
                </CollapsibleTrigger>
                {filters.sizes.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllSizes}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 ml-2"
                  >
                    Clear ({filters.sizes.length})
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <CollapsibleContent className="pb-3">
                {/* Women's Section */}
                <Collapsible open={expandedSections.women} onOpenChange={() => toggleSection('women')}>
                  <SectionHeader label="Women's" section="women" />
                  <CollapsibleContent className="pb-3">
                    <div className="space-y-3 pl-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Clothing (Alpha)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {FILTER_SIZES.women.clothing.alpha.map(size => (
                            <SizeChip key={`w-clothing-${size}`} size={size} category="clothing" fit="women" selected={filters.sizes.includes(makeSizeKey('women', 'clothing', size))} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Clothing (Numeric)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {FILTER_SIZES.women.clothing.numeric.map(size => (
                            <SizeChip key={`w-clothing-${size}`} size={size} category="clothing" fit="women" selected={filters.sizes.includes(makeSizeKey('women', 'clothing', size))} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Bottoms (Inches)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {FILTER_SIZES.women.clothing.inches.map(size => (
                            <SizeChip key={`w-clothing-${size}`} size={size} category="clothing" fit="women" selected={filters.sizes.includes(makeSizeKey('women', 'clothing', size))} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Shoes (AU)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {FILTER_SIZES.women.shoes.map(size => (
                            <SizeChip key={`w-shoes-${size}`} size={size} category="shoes" fit="women" selected={filters.sizes.includes(makeSizeKey('women', 'shoes', size))} />
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
                        <p className="text-xs text-muted-foreground mb-2">Clothing (Alpha)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {FILTER_SIZES.men.clothing.alpha.map(size => (
                            <SizeChip key={`m-clothing-${size}`} size={size} category="clothing" fit="men" selected={filters.sizes.includes(makeSizeKey('men', 'clothing', size))} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Bottoms (Inches)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {FILTER_SIZES.men.clothing.inches.map(size => (
                            <SizeChip key={`m-clothing-${size}`} size={size} category="clothing" fit="men" selected={filters.sizes.includes(makeSizeKey('men', 'clothing', size))} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Shoes (AU)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {FILTER_SIZES.men.shoes.map(size => (
                            <SizeChip key={`m-shoes-${size}`} size={size} category="shoes" fit="men" selected={filters.sizes.includes(makeSizeKey('men', 'shoes', size))} />
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
                        <p className="text-xs text-muted-foreground mb-2">Clothing (Alpha)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {FILTER_SIZES.unisex.clothing.alpha.map(size => (
                            <SizeChip key={`u-clothing-${size}`} size={size} category="clothing" fit="unisex" selected={filters.sizes.includes(makeSizeKey('unisex', 'clothing', size))} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Bottoms (Inches)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {FILTER_SIZES.unisex.clothing.inches.map(size => (
                            <SizeChip key={`u-clothing-${size}`} size={size} category="clothing" fit="unisex" selected={filters.sizes.includes(makeSizeKey('unisex', 'clothing', size))} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Shoes (AU F / M)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {FILTER_SIZES.unisex.shoes.map(size => (
                            <SizeChip key={`u-shoes-${size}`} size={size} category="shoes" fit="unisex" selected={filters.sizes.includes(makeSizeKey('unisex', 'shoes', size))} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Kids Section */}
                <Collapsible open={expandedSections.kids} onOpenChange={() => toggleSection('kids')}>
                  <SectionHeader label="Kids" section="kids" />
                  <CollapsibleContent className="pb-3">
                    <div className="space-y-3 pl-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Clothing</p>
                        <div className="flex flex-wrap gap-1.5">
                          {FILTER_SIZES.kids.clothing.sizes.map(size => (
                            <SizeChip key={`k-clothing-${size}`} size={size} category="clothing" fit="kids" selected={filters.sizes.includes(makeSizeKey('kids', 'clothing', size))} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Shoes (AU)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {FILTER_SIZES.kids.shoes.map(size => (
                            <SizeChip key={`k-shoes-${size}`} size={size} category="shoes" fit="kids" selected={filters.sizes.includes(makeSizeKey('kids', 'shoes', size))} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Condition */}
          <div className="py-3 border-t border-border pb-5">
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

          {/* Colour - Always expanded */}
          <div className="py-3 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg font-medium">Colour</span>
              {filters.colours.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllColours}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  Clear ({filters.colours.length})
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COLOURS.map((colour) => {
                const isSelected = filters.colours.includes(colour.toLowerCase());
                return (
                  <button
                    key={colour}
                    type="button"
                    onClick={() => toggleColour(colour)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isSelected ? 'bg-primary text-foreground' : 'bg-muted text-foreground hover:bg-muted/80'
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-full flex-shrink-0 border border-border/40"
                      style={{ background: COLOUR_SWATCHES[colour] || 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}
                    />
                    {colour}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Style - Always expanded */}
          <div className="py-3 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg font-medium">Style</span>
              {filters.styles.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllStyles}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  Clear ({filters.styles.length})
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((style) => {
                const isSelected = filters.styles.includes(style.toLowerCase());
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => toggleStyle(style)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isSelected ? 'bg-primary text-foreground' : 'bg-muted text-foreground hover:bg-muted/80'
                    }`}
                  >
                    {style}
                  </button>
                );
              })}
            </div>
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

        {/* Sticky Selected Filters + Bottom Buttons */}
        <div className="bg-background border-t border-border">
          {/* Selected Filters Bar */}
          {(() => {
            const selectedFilters: { label: string; type: string; value: string }[] = [];
            
            // Add genders
            filters.genders.forEach(g => {
              const fitLabel = FIT_OPTIONS.find(f => f.value === g)?.label || g;
              selectedFilters.push({ label: fitLabel, type: 'gender', value: g });
            });
            
            // Add sizes
            filters.sizes.forEach(sizeKey => {
              selectedFilters.push({ label: formatSizeKeyLabel(sizeKey), type: 'size', value: sizeKey });
            });
            
            // Add categories
            filters.categories.forEach(cat => {
              selectedFilters.push({ label: cat.charAt(0).toUpperCase() + cat.slice(1), type: 'category', value: cat });
            });
            
            // Add condition
            if (filters.condition) {
              selectedFilters.push({ label: filters.condition, type: 'condition', value: filters.condition });
            }
            
            // Add colours
            filters.colours.forEach(colour => {
              selectedFilters.push({ label: colour.charAt(0).toUpperCase() + colour.slice(1), type: 'colour', value: colour });
            });
            
            // Add styles
            filters.styles.forEach(style => {
              selectedFilters.push({ label: style.charAt(0).toUpperCase() + style.slice(1), type: 'style', value: style });
            });

            if (selectedFilters.length === 0) return null;

            return (
              <div className="px-6 py-3 border-b border-border">
                <div className="flex flex-wrap gap-2">
                  {selectedFilters.map((filter, index) => (
                    <button
                      key={`${filter.type}-${filter.value}-${index}`}
                      type="button"
                      onClick={() => {
                        if (filter.type === 'gender') {
                          toggleGender(filter.value);
                        } else if (filter.type === 'size') {
                          toggleSizeKey(filter.value);
                        } else if (filter.type === 'category') {
                          toggleCategory(filter.value);
                        } else if (filter.type === 'condition') {
                          setFilters(prev => ({ ...prev, condition: '' }));
                        } else if (filter.type === 'colour') {
                          toggleColour(filter.value);
                        } else if (filter.type === 'style') {
                          toggleStyle(filter.value);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-foreground"
                    >
                      {filter.label}
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
          
          {/* Buttons */}
          <div className="p-6 flex gap-4">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1 h-12 rounded-xl bg-muted text-foreground border-0 font-medium"
            >
              Reset
            </Button>
            <Button
              onClick={handleApply}
              className="flex-1 h-12 rounded-xl bg-foreground text-background font-medium hover:bg-foreground/90"
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default FilterSheet;
