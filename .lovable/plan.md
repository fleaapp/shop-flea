# Category and filter gap review

Reviewed the single source of truth (`src/config/sizeConfig.ts`) plus the filter sheet and category drawer. Here is what is missing compared to what AU resale shoppers expect.

## Missing clothing categories

**Tops** (currently 7 subcategories)
- Polo
- Crop top
- Bodysuit
- Long sleeve / Turtleneck
- Cardigan (currently nowhere in the app - a notable gap)

**Outerwear** (currently only Jacket, Coat)
- Blazer
- Puffer
- Raincoat
- Trench

**Bottoms** (currently Jeans, Skirt, Shorts, Pants)
- Leggings
- Cargo pants
- Trackpants / Joggers
- Overalls

**Dresses** (currently no subcategories)
- Mini / Midi / Maxi
- Formal / Gown

**Shoes** (currently 5)
- Flats / Loafers
- Slides / Thongs
- Mules

**Accessories** (currently Hats, Bags, Scarves / Gloves, Jewellery)
- Belts
- Sunglasses / Eyewear
- Watches
- Wallets / Purses
- Hair accessories

**New top-level categories worth adding**
- Suits / Co-ords (matching sets are a common resale listing with no home today)
- Maternity

## Missing filters

Current filters: Fit, Category, Size, Brand, Condition, Colour, Style, Price, Hide sold.

Gaps:
- Sort order (Newest, Price low to high, Price high to low) - there is no sort control at all
- Free or low shipping
- Accepts offers (we already store `offers_enabled`)
- Recently listed (last 24h / 7 days)

## Notes

- Everything flows from `CATEGORY_OPTIONS`, so adding subcategories automatically updates the listing drawer, filter sheet, and search.
- Size bucketing is resolved by helper functions matching category values. New bottoms subcategories (leggings, cargo, trackpants, overalls) must be added to `isBottomsCategory`, and new accessory subcategories to `isAccessoryCategory`, or they will get the wrong size set.
- Existing listings keep their current category values; nothing needs backfilling.

## Suggested next step

Confirm which of the above you want and I will add them in one pass, including the size-bucket helper updates.
