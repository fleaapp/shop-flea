import { useMemo, useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { CATEGORY_OPTIONS } from '@/config/sizeConfig';

interface CategorySelectionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCategory: string;
  selectedSubcategory: string;
  onSelectCategory: (category: string, subcategory: string) => void;
}

const CategorySelectionDrawer = ({
  open,
  onOpenChange,
  selectedCategory,
  selectedSubcategory,
  onSelectCategory,
}: CategorySelectionDrawerProps) => {
  const [viewingCategory, setViewingCategory] = useState<string | null>(null);

  const currentCategory = useMemo(() => {
    return CATEGORY_OPTIONS.find(c => c.value === viewingCategory);
  }, [viewingCategory]);

  const handleCategoryTap = (category: typeof CATEGORY_OPTIONS[number]) => {
    if (category.subcategories && category.subcategories.length > 0) {
      // Has subcategories - show them
      setViewingCategory(category.value);
    } else {
      // No subcategories - select directly
      onSelectCategory(category.value, '');
      onOpenChange(false);
      setViewingCategory(null);
    }
  };

  const handleSubcategoryTap = (subcategory: { value: string; label: string }) => {
    if (viewingCategory) {
      onSelectCategory(viewingCategory, subcategory.value);
      onOpenChange(false);
      setViewingCategory(null);
    }
  };

  const handleBack = () => {
    setViewingCategory(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setViewingCategory(null);
    }
    onOpenChange(open);
  };

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="max-h-[85dvh] rounded-t-3xl border-0 bg-background">
        <DrawerHeader className="pb-2">
          <div className="flex items-center justify-center relative">
            {viewingCategory && (
              <button
                onClick={handleBack}
                className="absolute left-0 p-2 -ml-2 rounded-full hover:bg-muted"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <DrawerTitle className="text-center text-xl font-semibold">
              {currentCategory ? currentCategory.label : 'Select Category'}
            </DrawerTitle>
          </div>
        </DrawerHeader>
        
        <div className="px-6 pb-8 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
          {!viewingCategory ? (
            // Main category list
            <div className="flex flex-wrap gap-2 justify-center">
              {CATEGORY_OPTIONS.map((cat) => {
                const isSelected = selectedCategory === cat.value;
                const hasSubcats = cat.subcategories && cat.subcategories.length > 0;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => handleCategoryTap(cat)}
                    className={`px-4 py-2.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
                      isSelected
                        ? 'bg-primary text-foreground'
                        : 'bg-muted text-foreground hover:bg-muted/80'
                    }`}
                  >
                    {cat.label}
                    {hasSubcats && <ChevronRight className="h-4 w-4 opacity-60" />}
                  </button>
                );
              })}
            </div>
          ) : (
            // Subcategory list
            <div className="flex flex-wrap gap-2 justify-center">
              {currentCategory?.subcategories?.map((subcat) => {
                const isSelected = selectedCategory === viewingCategory && selectedSubcategory === subcat.value;
                return (
                  <button
                    key={subcat.value}
                    type="button"
                    onClick={() => handleSubcategoryTap(subcat)}
                    className={`px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-primary text-foreground'
                        : 'bg-muted text-foreground hover:bg-muted/80'
                    }`}
                  >
                    {subcat.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default CategorySelectionDrawer;
