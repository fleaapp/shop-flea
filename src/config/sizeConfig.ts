// Centralized size configuration for Flea
// Sizes depend on Fit (Gender) and Category

export type FitType = 'women' | 'men' | 'unisex';
export type CategoryType = 'clothing' | 'bottoms' | 'shoes';

export const FIT_OPTIONS = [
  { value: 'women', label: "Women's" },
  { value: 'men', label: "Men's" },
  { value: 'unisex', label: 'Unisex' },
] as const;

export const CATEGORY_OPTIONS = [
  { value: 'clothing', label: 'Clothing' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'shoes', label: 'Shoes' },
] as const;

// Helper to generate range of numbers
const range = (start: number, end: number, step: number = 1): number[] => {
  const result: number[] = [];
  for (let i = start; i <= end; i += step) {
    result.push(i);
  }
  return result;
};

// Helper to generate shoe sizes with half sizes
const shoeRange = (start: number, end: number): string[] => {
  const result: string[] = [];
  for (let i = start; i <= end; i += 0.5) {
    result.push(i % 1 === 0 ? i.toString() : i.toFixed(1));
  }
  return result;
};

// Women's sizes
const WOMENS_CLOTHING = ['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22', '24', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'One Size Fits All'];
const WOMENS_BOTTOMS = [...range(20, 42).map(String), 'One Size Fits All'];
const WOMENS_SHOES = shoeRange(3, 13.5); // AU 3-13.5

// Men's sizes
const MENS_CLOTHING = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', 'One Size Fits All'];
const MENS_BOTTOMS = [...range(20, 50).map(String), 'One Size Fits All'];
const MENS_SHOES = shoeRange(5, 17); // AU 5-17

// Unisex sizes
const UNISEX_CLOTHING = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', 'One Size Fits All'];
const UNISEX_BOTTOMS = [...range(20, 40).map(String), 'One Size Fits All'];
const UNISEX_SHOES = shoeRange(3, 17); // AU 3-17

// Size configuration map
export const SIZE_CONFIG: Record<FitType, Record<CategoryType, string[]>> = {
  women: {
    clothing: WOMENS_CLOTHING,
    bottoms: WOMENS_BOTTOMS,
    shoes: WOMENS_SHOES,
  },
  men: {
    clothing: MENS_CLOTHING,
    bottoms: MENS_BOTTOMS,
    shoes: MENS_SHOES,
  },
  unisex: {
    clothing: UNISEX_CLOTHING,
    bottoms: UNISEX_BOTTOMS,
    shoes: UNISEX_SHOES,
  },
};

// Get sizes based on fit and category
export const getSizesForFitAndCategory = (fit: string, category: string): string[] => {
  const normalizedFit = fit.toLowerCase() as FitType;
  const normalizedCategory = category.toLowerCase() as CategoryType;
  
  if (!SIZE_CONFIG[normalizedFit]) return [];
  if (!SIZE_CONFIG[normalizedFit][normalizedCategory]) return [];
  
  return SIZE_CONFIG[normalizedFit][normalizedCategory];
};

// Get all possible sizes (for display purposes when no filter is applied)
export const getAllSizes = (): string[] => {
  const allSizes = new Set<string>();
  
  Object.values(SIZE_CONFIG).forEach(categories => {
    Object.values(categories).forEach(sizes => {
      sizes.forEach(size => allSizes.add(size));
    });
  });
  
  return Array.from(allSizes);
};

// Other listing options (unchanged)
export const CONDITIONS = ['New with tags', 'Like new', 'Good', 'Fair'];
export const COLOURS = ['Black', 'White', 'Grey', 'Navy', 'Blue', 'Red', 'Pink', 'Green', 'Brown', 'Beige', 'Multi'];
export const STYLES = ['Casual', 'Formal', 'Streetwear', 'Vintage', 'Sporty', 'Bohemian', 'Minimalist', 'Other'];
