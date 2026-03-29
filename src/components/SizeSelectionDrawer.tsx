import { useMemo } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { getSizeSectionsForListing, isShoeCategory } from '@/config/sizeConfig';

interface SizeSelectionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fit: string;
  category: string;
  selectedSize: string;
  onSelectSize: (size: string) => void;
}

const SizeSelectionDrawer = ({
  open,
  onOpenChange,
  fit,
  category,
  selectedSize,
  onSelectSize,
}: SizeSelectionDrawerProps) => {
  const sizeSections = useMemo(() => {
    if (!fit || !category) return {};
    return getSizeSectionsForListing(fit, isShoeCategory(category) ? 'shoes' : category);
  }, [fit, category]);

  const handleSizeSelect = (size: string) => {
    onSelectSize(size.toLowerCase());
    onOpenChange(false);
  };

  const sectionEntries = Object.entries(sizeSections);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-0">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-center text-xl font-semibold">Select Size</DrawerTitle>
        </DrawerHeader>
        
        <div className="px-6 pb-8 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
          {!fit || !category ? (
            <p className="text-center text-muted-foreground py-8">
              {!fit ? "Please select Fit/Gender first" : "Please select Category first"}
            </p>
          ) : sectionEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No sizes available for this selection
            </p>
          ) : (
            <div className="space-y-5">
              {sectionEntries.map(([sectionName, sizes]) => (
                <div key={sectionName}>
                  <p className="text-sm text-muted-foreground mb-2 font-medium">{sectionName}</p>
                  <div className="flex flex-wrap gap-2 justify-start">
                    {(sizes as string[]).map((size) => {
                      const isSelected = selectedSize === size.toLowerCase();
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => handleSizeSelect(size)}
                          className={`px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-primary text-foreground'
                              : 'bg-muted text-foreground hover:bg-muted/80'
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default SizeSelectionDrawer;
