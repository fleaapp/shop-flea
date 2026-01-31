import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, X } from 'lucide-react';
import { FILTER_SIZES, FIT_OPTIONS } from '@/config/sizeConfig';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface FilterPreferencesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FilterPreferencesSheet = ({ open, onOpenChange }: FilterPreferencesSheetProps) => {
  const { user, refreshProfile, profile } = useAuth();
  const [preferredSizes, setPreferredSizes] = useState<string[]>([]);
  const [preferredGender, setPreferredGender] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    women: false,
    men: false,
    unisex: false,
  });

  // Load profile data when opened
  useEffect(() => {
    if (open && profile) {
      const profileData = profile as any;
      setPreferredSizes(profileData.preferred_sizes || []);
      setPreferredGender(profileData.preferred_gender || null);
    }
  }, [open, profile]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleSize = (size: string) => {
    setPreferredSizes(prev => 
      prev.includes(size) 
        ? prev.filter(s => s !== size)
        : [...prev, size]
    );
  };

  const clearAllSizes = () => {
    setPreferredSizes([]);
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          preferred_sizes: preferredSizes,
          preferred_gender: preferredGender,
        } as any)
        .eq('user_id', user.id);

      if (error) throw error;
      
      await refreshProfile();
      toast.success('Preferences saved');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setIsLoading(false);
    }
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-center">Filter Preferences</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6 pb-8">
          {/* Gender Preferences */}
          <div>
            <label className="text-sm font-medium text-foreground mb-3 block">Preferred Fit</label>
            <div className="flex flex-wrap gap-2">
              {FIT_OPTIONS.map((fit) => (
                <button
                  key={fit.value}
                  onClick={() => setPreferredGender(preferredGender === fit.value ? null : fit.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    preferredGender === fit.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {fit.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size Preferences */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-foreground">Preferred Sizes</label>
              {preferredSizes.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllSizes}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  Clear ({preferredSizes.length})
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
                    <p className="text-xs text-muted-foreground mb-2">Clothing (Alpha)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FILTER_SIZES.women.clothing.alpha.map(size => (
                        <SizeChip key={size} size={size} selected={preferredSizes.includes(size)} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Clothing (Numeric)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FILTER_SIZES.women.clothing.numeric.map(size => (
                        <SizeChip key={size} size={size} selected={preferredSizes.includes(size)} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Bottoms (Inches)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FILTER_SIZES.women.clothing.inches.map(size => (
                        <SizeChip key={size} size={size} selected={preferredSizes.includes(size)} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Shoes (AU)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FILTER_SIZES.women.shoes.map(size => (
                        <SizeChip key={size} size={size} selected={preferredSizes.includes(size)} />
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
                        <SizeChip key={size} size={size} selected={preferredSizes.includes(size)} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Bottoms (Inches)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FILTER_SIZES.men.clothing.inches.map(size => (
                        <SizeChip key={size} size={size} selected={preferredSizes.includes(size)} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Shoes (AU)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FILTER_SIZES.men.shoes.map(size => (
                        <SizeChip key={size} size={size} selected={preferredSizes.includes(size)} />
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
                        <SizeChip key={size} size={size} selected={preferredSizes.includes(size)} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Bottoms (Inches)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FILTER_SIZES.unisex.clothing.inches.map(size => (
                        <SizeChip key={size} size={size} selected={preferredSizes.includes(size)} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Shoes (AU F / M)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FILTER_SIZES.unisex.shoes.map(size => (
                        <SizeChip key={size} size={size} selected={preferredSizes.includes(size)} />
                      ))}
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <Button 
            onClick={handleSave}
            disabled={isLoading}
            className="w-full h-12 rounded-full bg-primary text-primary-foreground font-medium"
          >
            {isLoading ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FilterPreferencesSheet;
