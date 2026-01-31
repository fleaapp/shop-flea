// Centralized size configuration for Flea
// Single source of truth for both listings and filters

export type FitType = 'women' | 'men' | 'unisex';
export type CategoryType = 'clothing' | 'shoes';

export const FIT_OPTIONS = [
  { value: 'women', label: "Women's" },
  { value: 'men', label: "Men's" },
  { value: 'unisex', label: 'Unisex' },
] as const;

export const CATEGORY_OPTIONS = [
  { value: 'clothing', label: 'Clothing' },
  { value: 'shoes', label: 'Shoes' },
] as const;

// Helper to generate shoe sizes with half sizes
const shoeRange = (start: number, end: number): string[] => {
  const result: string[] = [];
  for (let i = start; i <= end; i += 0.5) {
    result.push(i % 1 === 0 ? i.toString() : i.toFixed(1));
  }
  return result;
};

// Women's sizes
const WOMENS_CLOTHING_NUMERIC = ['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22', '24'];
const WOMENS_CLOTHING_ALPHA = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const WOMENS_CLOTHING = [...WOMENS_CLOTHING_NUMERIC, ...WOMENS_CLOTHING_ALPHA, 'ONE SIZE', 'OTHER'];
const WOMENS_SHOES = shoeRange(3, 13.5); // AU 3-13.5, NO ONE SIZE

// Men's sizes
const MENS_CLOTHING_ALPHA = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
const MENS_CLOTHING = [...MENS_CLOTHING_ALPHA, 'ONE SIZE', 'OTHER'];
const MENS_SHOES = shoeRange(5, 17); // AU 5-17, NO ONE SIZE

// Unisex sizes
const UNISEX_CLOTHING_ALPHA = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
const UNISEX_CLOTHING = [...UNISEX_CLOTHING_ALPHA, 'ONE SIZE', 'OTHER'];
const UNISEX_SHOES = shoeRange(3, 17); // AU 3-17, NO ONE SIZE

// Size configuration map for listings (single select)
export const SIZE_CONFIG: Record<FitType, Record<CategoryType, string[]>> = {
  women: {
    clothing: WOMENS_CLOTHING,
    shoes: WOMENS_SHOES,
  },
  men: {
    clothing: MENS_CLOTHING,
    shoes: MENS_SHOES,
  },
  unisex: {
    clothing: UNISEX_CLOTHING,
    shoes: UNISEX_SHOES,
  },
};

// Get sizes based on fit and category (for listings)
export const getSizesForFitAndCategory = (fit: string, category: string): string[] => {
  const normalizedFit = fit.toLowerCase() as FitType;
  const normalizedCategory = category.toLowerCase() as CategoryType;
  
  if (!SIZE_CONFIG[normalizedFit]) return [];
  if (!SIZE_CONFIG[normalizedFit][normalizedCategory]) return [];
  
  return SIZE_CONFIG[normalizedFit][normalizedCategory];
};

// Filter size definitions - organized by gender for the accordion structure
export const FILTER_SIZES = {
  women: {
    clothing: {
      numeric: WOMENS_CLOTHING_NUMERIC,
      alpha: WOMENS_CLOTHING_ALPHA,
    },
    shoes: shoeRange(3, 13.5),
  },
  men: {
    clothing: {
      alpha: MENS_CLOTHING_ALPHA,
    },
    shoes: shoeRange(5, 17),
  },
  unisex: {
    clothing: {
      alpha: UNISEX_CLOTHING_ALPHA,
    },
    shoes: shoeRange(3, 17),
  },
} as const;

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
