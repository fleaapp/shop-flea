## Goal

Restructure sizing in `src/config/sizeConfig.ts` so:

- **Bottoms** (jeans, pants, skirts, shorts): Alpha + Numeric + Inches + ONE SIZE + OTHER
- **All other clothing** (tops, dresses, outerwear, sleepwear, underwear, activewear, swimwear, playsuits/jumpsuits): Alpha + Numeric only (+ ONE SIZE / OTHER extras)
- **Shoes**: unchanged (own set per fit)
- **Accessories**: size is optional — drawer offers only `ONE SIZE` and `OTHER`, and the size field on the listing form is non-required for the Accessories category
- **Men's**: add a numeric size set so men's non-bottoms also get Alpha + Numeric

## Fit isolation (confirmed)

Sizes are already stored as 3-part keys `fit:category:size` via `src/utils/sizeKeys.ts`, so filtering Women's XS never matches Men's XS. This restructure keeps that scoping — each fit has its own alpha/numeric/inches sets, and both listings and filter selections stay fit-scoped.

## Changes

### 1. `src/config/sizeConfig.ts`
- Split clothing into two sub-buckets: `bottoms` and `general`.
- Add helpers `isBottomsCategory(category)` (covers `bottoms` + subcategories `jeans`, `skirt`, `shorts`, `pants`) and `isAccessoryCategory(category)`.
- Add `MENS_CLOTHING_NUMERIC` — proposed range `28, 30, 32, 34, 36, 38, 40, 42, 44, 46` (AU menswear inches). Say the word if you'd rather use another scale.
- Rebuild `LISTING_SIZE_SECTIONS` and `SIZE_CONFIG`:
  - Women's bottoms → Alpha + Numeric + Inches + Extras
  - Women's general → Alpha + Numeric + Extras
  - Men's bottoms → Alpha + Numeric (waist) + Inches + Extras
  - Men's general → Alpha + Numeric + Extras
  - Unisex bottoms → Alpha + Inches + Extras
  - Unisex general → Alpha + Extras
  - Kids clothing → unchanged
  - Accessories (any fit) → `{ 'Size': ['ONE SIZE', 'OTHER'] }`
- Update `getSizeSectionsForListing` / `getSizesForFitAndCategory` to branch on `bottoms` / `general` / `accessories` / `shoes`.
- Update `FILTER_SIZES` to mirror the same structure so the filter sheet stays in sync — men's now shows a numeric column, women's/men's general clothing drops inches, bottoms keep all three.

### 2. Listing form (`src/pages/CreateListing.tsx` and `src/pages/EditListing.tsx`)
- When the selected top-level category is `accessories`, mark the Size field as optional and skip the "size required" validation.
- All other listing/filter behaviour stays the same.

### 3. Database CHECK constraint (blocker from earlier screenshot)
The current `listings_category_valid` CHECK only allows `tops, bottoms, dresses, outerwear, shoes, accessories, bags, other`, which is why Activewear/Swimwear/Sleepwear/etc. currently error. Migration replaces it with the full app category list:

`tops, outerwear, bottoms, dresses, playsuits-jumpsuits, sleepwear, underwear, activewear, swimwear, shoes, accessories, other` (keeping `bags` allowed for any legacy rows).

## Verification

- Create a listing in Bottoms → drawer shows Alpha + Numeric + Inches + Extras.
- Create a listing in Tops / Dresses / Activewear / Swimwear → drawer shows Alpha + Numeric + Extras, no inches.
- Create a listing in Accessories → size field is optional; drawer offers ONE SIZE / OTHER only; can post without picking a size.
- Create a listing in Shoes → unchanged.
- Men's Tops now show numeric sizes alongside alpha.
- Previously-blocked categories (Activewear, Swimwear, Sleepwear, Underwear, Playsuit/Jumpsuit) post successfully.
- In the filter sheet, picking Women's XS returns only women's listings — men's XS listings do not match, and vice versa.