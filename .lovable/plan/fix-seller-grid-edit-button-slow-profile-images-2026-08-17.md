# Fix seller grid edit button + slow profile images

## 1. Edit button appears on other sellers' items

`ProfileGridCard` always renders the ✏️ edit button whenever the active tab is "Listings". Both your own profile and other sellers' profiles use this same card, so the button shows on items you don't own and leads to an edit screen you can't use.

Fix: the card only shows the edit button when the listing belongs to the signed-in user. Your own profile keeps it, seller profiles never show it. The row/list view already handles this correctly, so grid view will now match.

## 2. Images load slowly on profiles

Two confirmed causes:

- 6 of 25 listings have no stored thumbnail, so the grid downloads the full-size photo (often several hundred KB each) instead of the small one.
- Every grid image is lazy-loaded, including the first ones already on screen, so they only start downloading after layout settles.

Fix:
- When a listing has no stored thumbnail, request a resized version from storage on the fly instead of the full-size original.
- Load the first four grid images eagerly with high fetch priority; keep the rest lazy.
- Keep the fixed 4:5 image box with a neutral placeholder so nothing shifts while loading.
- One-off backfill so the older listings get proper stored thumbnails and stop relying on the on-the-fly fallback.

## Technical notes

- `src/components/ProfileGridCard.tsx`: add an `isOwner` prop (default false); gate the edit button on it. `src/pages/Profile.tsx` passes `true`; `src/pages/SellerProfile.tsx` leaves it off.
- `src/utils/optimizedImage.ts`: reinstate `getCardImageUrl` as a real transform (`/storage/v1/render/image/public/` with `width=400&quality=70`) used only as the fallback path when `thumbnails[0]` is absent; stored thumbnails pass through unchanged.
- `ProfileGridCard` accepts an `index` (or `priority`) prop; index < 4 renders `loading="eager" fetchpriority="high"`, others stay `loading="lazy" decoding="async"`.
- Backfill: generate and store `thumbnails` for the listings currently missing them, matching the existing `.thumb.jpg` naming used on upload.
