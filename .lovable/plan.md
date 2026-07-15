## Listing details: shared-link web preview mode

Rule: when someone opens a listing URL in a mobile web browser (i.e. not the native app, not an installed PWA), we treat that view as a "shared link preview":

- Show the `InstallAppBanner`.
- Hide the sticky footer action buttons (Buy / Add to cart / Message seller, etc.).
- Everything else on the details page stays as-is.

When the same URL opens inside the native app or installed PWA (universal link / app link), it renders the normal listing details with the footer actions and no download banner. `InstallAppBanner` already gates itself on `Capacitor.isNativePlatform` + `display-mode: standalone`, so that half is done.

### Changes

1. `src/pages/ListingDetails.tsx`
   - Add a small helper (or reuse a hook) that returns `isSharedWebPreview = !native && !standalone`.
   - Wrap the sticky footer (currently around line 712, `<div data-listing-footer ...>` and its `isRemoved / isOwner / normal` branches) so it does not render when `isSharedWebPreview` is true.
   - Keep the existing `<InstallAppBanner />` render at line 699 as-is (it self-hides in-app).

2. Official store badges
   - Replace the hand-drawn Apple + Google SVGs in `src/components/InstallAppBanner.tsx` with the official "Download on the App Store" and "Get it on Google Play" badges used on the landing page project so they no longer look skewed. I'll copy the exact SVG/asset markup from the landing page.

### Technical notes

- Native + PWA detection lives in `InstallAppBanner.tsx` already; I'll extract it into a tiny `useIsWebSharedPreview()` hook in `src/hooks/` so both the banner and `ListingDetails` share one source of truth.
- No route changes, no changes to how deep links open in the app. Universal Links / App Links continue to hand off to the native app when installed; when they do, `Capacitor.isNativePlatform()` is true, so both the banner and the footer suppression turn off automatically.
- No backend or schema changes.
