# Fix slow images: photos are being saved as huge PNGs

## What I found (measured, not guessed)

I pulled real listing images straight from storage and inspected them:

- The "compressed" main photo is **1.67 MB** and is actually a **PNG**, despite being named `.webp` and served as `image/webp`.
- The "thumbnail" used on cards and profile grids is **717 KB** - also a PNG, 600x750.
- The on-the-fly CDN resize added recently returns **740 KB** and a distorted 400x1200 image, so it makes things slower, not faster.

Cause: the compressor writes with `canvas.toBlob(..., 'image/webp')`. On iOS Safari / the native WebView, WebP encoding from canvas is not supported, so the browser silently falls back to PNG. Photos come out roughly 20-30x larger than intended. That is why posting is slow (uploading ~2.4 MB per photo), why the swipe card is slow, and why profile grids crawl (6-8 x 717 KB at once).

## The fix

1. **Never produce PNG again.** Detect what the device can actually encode: use WebP when supported, otherwise JPEG. The file extension, storage content type, and the real encoded format will always match.
2. **Right-size the outputs for speed, not bulk.** Grid/card thumbnail: 400x500 at quality 0.7 (roughly 20-40 KB, down from 717 KB). Swipe-card / detail image: 1080px on the long edge at quality 0.78 (roughly 90-160 KB, down from 1.67 MB). At 4:5 on a 3x phone screen those still render pin-sharp - the current files are large purely because they are accidental PNGs, not because they carry more visible detail.
3. **Faster posting.** Upload the photos in parallel instead of one after another, and upload each photo's thumbnail alongside it rather than after it.
4. **Drop the CDN resize fallback.** It is slower than the original file on this plan and distorts the crop. Grids go back to direct storage URLs.
5. **One-off backfill.** Re-encode the existing 32 listings (including the 6 with no stored thumbnail) into proper small thumbnails so old items load fast too, without touching the original photos.

Everything else stays as is: the 4:5 crop, eager loading of the first four grid images, and the owner-only edit button.

## Technical notes

- `src/utils/imageCompression.ts`: add a memoised `supportsWebp()` probe (`canvas.toDataURL('image/webp')` prefix check); resolve the target mime from it; verify the returned blob's `type` and fall back to JPEG if the browser handed back something else. Return the correct extension from the helper so callers stop hardcoding `.webp`. Defaults become `maxWidth/maxHeight: 1080, quality: 0.78`; `createThumbnail` becomes `maxWidth: 400, maxHeight: 500, quality: 0.7`. Raise the "already small, skip compression" bar from 100 KB to 150 KB but still re-encode anything that is not JPEG/WebP.
- `src/pages/CreateListing.tsx` (and `EditListing.tsx` where it does the same upload): derive `fileExt`/`contentType` from the produced file's mime instead of the literal `'webp'`; run the per-image work with `Promise.all`.
- `src/utils/optimizedImage.ts`: `getGridFallbackUrl` returns the URL unchanged (matches the existing "avoid Supabase CDN transforms" rule); keep the function so callers do not change.
- Backfill: an edge function reads each listing's `images[0]`, re-encodes to a small JPEG/WebP, writes `<stem>.thumb.jpg`, and updates `thumbnails`. Originals are left untouched.
