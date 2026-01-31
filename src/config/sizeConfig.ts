// Centralized size and category configuration for Flea
// Single source of truth for both listings and filters

export type FitType = 'women' | 'men' | 'unisex';
export type CategoryType = 'clothing' | 'shoes';

export const FIT_OPTIONS = [
  { value: 'women', label: "Women's" },
  { value: 'men', label: "Men's" },
  { value: 'unisex', label: 'Unisex' },
] as const;

// Hierarchical category structure with subcategories
export const CATEGORY_OPTIONS = [
  { 
    value: 'tops', 
    label: 'Tops',
    subcategories: [
      { value: 'tshirt', label: 'T-shirt' },
      { value: 'shirt-blouse', label: 'Shirt / Blouse' },
      { value: 'singlet-cami', label: 'Singlet / Cami' },
      { value: 'strapless', label: 'Strapless' },
      { value: 'jumper-sweater', label: 'Jumper / Sweater' },
      { value: 'sweatshirt-hoodie', label: 'Sweatshirt / Hoodie' },
      { value: 'vest', label: 'Vest' },
    ],
  },
  { 
    value: 'outerwear', 
    label: 'Outerwear',
    subcategories: [
      { value: 'jacket', label: 'Jacket' },
      { value: 'coat', label: 'Coat' },
    ],
  },
  { 
    value: 'bottoms', 
    label: 'Bottoms',
    subcategories: [
      { value: 'jeans', label: 'Jeans' },
      { value: 'skirt', label: 'Skirt' },
      { value: 'shorts', label: 'Shorts' },
      { value: 'pants', label: 'Pants' },
    ],
  },
  { value: 'sleepwear', label: 'Sleepwear', subcategories: [] },
  { value: 'underwear', label: 'Underwear', subcategories: [] },
  { value: 'activewear', label: 'Activewear', subcategories: [] },
  { value: 'swimwear', label: 'Swimwear', subcategories: [] },
  { 
    value: 'shoes', 
    label: 'Shoes',
    subcategories: [
      { value: 'boots', label: 'Boots' },
      { value: 'sandals', label: 'Sandals' },
      { value: 'running-sneakers', label: 'Running sneakers' },
      { value: 'casual-sneakers', label: 'Casual sneakers' },
      { value: 'heels-dress-shoes', label: 'Heels / dress shoes' },
    ],
  },
  { 
    value: 'accessories', 
    label: 'Accessories',
    subcategories: [
      { value: 'hats', label: 'Hats' },
      { value: 'bags', label: 'Bags' },
      { value: 'scarves-gloves', label: 'Scarves / Gloves' },
      { value: 'jewellery', label: 'Jewellery' },
    ],
  },
  { value: 'other', label: 'Other', subcategories: [] },
] as const;

// Flat list for simple category dropdown (value only)
export const FLAT_CATEGORY_OPTIONS = CATEGORY_OPTIONS.map(c => ({ value: c.value, label: c.label }));

// Check if a category is a shoe category
export const isShoeCategory = (category: string): boolean => {
  return category.toLowerCase() === 'shoes';
};

// Check if category supports ONE SIZE (clothing categories except shoes)
export const supportsOneSize = (category: string): boolean => {
  const cat = category.toLowerCase();
  return cat !== 'shoes' && !cat.includes('shoes');
};

// ===== WOMEN'S SIZES =====
const WOMENS_CLOTHING_ALPHA = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const WOMENS_CLOTHING_NUMERIC = ['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22', '24'];
const WOMENS_BOTTOMS_INCHES = [
  '20"', '21"', '22"', '23"', '24"', '25"', '26"', '27"', '28"', '29"',
  '30"', '31"', '32"', '34"', '35"', '36"', '37"', '38"', '39"', '40"'
];
const WOMENS_EXTRAS = ['ONE SIZE', 'OTHER'];
const WOMENS_CLOTHING = [...WOMENS_CLOTHING_ALPHA, ...WOMENS_CLOTHING_NUMERIC, ...WOMENS_BOTTOMS_INCHES, ...WOMENS_EXTRAS];

// Women's shoes: AU 3-14 including half sizes
const WOMENS_SHOES = [
  '3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5',
  '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13', '13.5', '14'
];

// ===== MEN'S SIZES =====
const MENS_CLOTHING_ALPHA = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
const MENS_BOTTOMS_INCHES = [
  '25"', '26"', '28"', '30"', '32"', '34"', '36"', '38"', '40"', '42"', '44"'
];
const MENS_EXTRAS = ['ONE SIZE', 'OTHER'];
const MENS_CLOTHING = [...MENS_CLOTHING_ALPHA, ...MENS_BOTTOMS_INCHES, ...MENS_EXTRAS];

// Men's shoes: AU 5-17.5 including half sizes
const MENS_SHOES = [
  '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5',
  '10', '10.5', '11', '11.5', '12', '12.5', '13', '13.5', '14', '14.5',
  '15', '15.5', '16', '16.5', '17', '17.5'
];

// ===== UNISEX SIZES =====
const UNISEX_CLOTHING_ALPHA = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
const UNISEX_BOTTOMS_INCHES = [
  '21"', '22"', '23"', '24"', '25"', '26"', '28"', '30"', '32"', '34"', '36"', '38"', '40"', '42"', '44"'
];
const UNISEX_CLOTHING = [...UNISEX_CLOTHING_ALPHA, ...UNISEX_BOTTOMS_INCHES];

// Unisex shoes with F/M equivalents
const UNISEX_SHOES = [
  'F3 / M1.5', 'F3.5 / M2', 'F4 / M2.5', 'F4.5 / M3', 'F5 / M3.5',
  'F5.5 / M4', 'F6 / M4.5', 'F6.5 / M5', 'F7 / M5.5', 'F7.5 / M6',
  'F8 / M6.5', 'F8.5 / M7', 'F9 / M7.5', 'F9.5 / M8', 'F10 / M8.5',
  'F10.5 / M9', 'F11 / M9.5', 'F11.5 / M10', 'F12 / M10.5', 'F12.5 / M11',
  'F13 / M11.5', 'F13.5 / M12', 'F14 / M12.5', 'F14.5 / M13', 'F15 / M13.5',
  'F15.5 / M14', 'F16 / M14.5', 'F16.5 / M15', 'F17 / M15.5', 'F17.5 / M16'
];

// Size configuration map for listings (single select by fit)
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

// Sectioned size configuration for listings drawer (3 sections for clothing)
export const LISTING_SIZE_SECTIONS = {
  women: {
    clothing: {
      'Clothing (Alpha)': WOMENS_CLOTHING_ALPHA,
      'Clothing (Numeric)': WOMENS_CLOTHING_NUMERIC,
      'Bottoms (Inches)': WOMENS_BOTTOMS_INCHES,
      'Extras': WOMENS_EXTRAS,
    },
    shoes: {
      'Shoes (AU)': WOMENS_SHOES,
    },
  },
  men: {
    clothing: {
      'Clothing (Alpha)': MENS_CLOTHING_ALPHA,
      'Bottoms (Inches)': MENS_BOTTOMS_INCHES,
      'Extras': MENS_EXTRAS,
    },
    shoes: {
      'Shoes (AU)': MENS_SHOES,
    },
  },
  unisex: {
    clothing: {
      'Clothing (Alpha)': UNISEX_CLOTHING_ALPHA,
      'Bottoms (Inches)': UNISEX_BOTTOMS_INCHES,
    },
    shoes: {
      'Shoes (AU F / M)': UNISEX_SHOES,
    },
  },
} as const;

// Get sectioned sizes for listing drawer
export const getSizeSectionsForListing = (fit: string, category: string): Record<string, string[]> => {
  const normalizedFit = fit.toLowerCase() as FitType;
  const isShoes = isShoeCategory(category);
  const categoryKey: CategoryType = isShoes ? 'shoes' : 'clothing';
  
  if (!LISTING_SIZE_SECTIONS[normalizedFit]) return {};
  return LISTING_SIZE_SECTIONS[normalizedFit][categoryKey] || {};
};

// Get sizes based on fit and category (for listings - flat array)
export const getSizesForFitAndCategory = (fit: string, category: string): string[] => {
  const normalizedFit = fit.toLowerCase() as FitType;
  const isShoes = isShoeCategory(category);
  const categoryKey: CategoryType = isShoes ? 'shoes' : 'clothing';
  
  if (!SIZE_CONFIG[normalizedFit]) return [];
  if (!SIZE_CONFIG[normalizedFit][categoryKey]) return [];
  
  return SIZE_CONFIG[normalizedFit][categoryKey];
};

// Filter size definitions - organized by gender for the accordion structure
export const FILTER_SIZES = {
  women: {
    clothing: {
      alpha: WOMENS_CLOTHING_ALPHA,
      numeric: WOMENS_CLOTHING_NUMERIC,
      inches: WOMENS_BOTTOMS_INCHES,
    },
    shoes: WOMENS_SHOES,
  },
  men: {
    clothing: {
      alpha: MENS_CLOTHING_ALPHA,
      inches: MENS_BOTTOMS_INCHES,
    },
    shoes: MENS_SHOES,
  },
  unisex: {
    clothing: {
      alpha: UNISEX_CLOTHING_ALPHA,
      inches: UNISEX_BOTTOMS_INCHES,
    },
    shoes: UNISEX_SHOES,
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

// Other listing options
export const CONDITIONS = ['New with tags', 'Like new', 'Good', 'Fair'];

export const COLOURS = [
  'Black', 'White', 'Grey', 'Navy', 'Blue', 'Green', 'Khaki', 
  'Beige / Cream', 'Brown', 'Red', 'Pink', 'Purple', 'Yellow', 
  'Orange', 'Silver', 'Gold', 'Tan', 'Multi / Patterned'
];

export const STYLES = [
  'Active', 'Casual', 'Vintage', 'Y2K', 'Boho', 'Surf', 
  'Summer', 'Winter', 'Streetwear', 'Lounge', 'Formal', 'Office', 'Other'
];
