# Reorganise Settings into General / Buyer / Seller / Support / Logout

## Goal
Restructure the Settings page so users can find account, buying, selling, support and logout options in clearly labelled sections.

## Proposed layout

### 1. General
- Edit Profile
- Notifications toggle
- Admin Dashboard (admins only, with badge)

### 2. Buyer
- Refresh Passed Listings
- Filter Preferences

### 3. Seller
- Become a Seller / Seller Dashboard - existing `PaymentMethodsSection` row (shows available/pending balance when verified, onboarding status when not)
- Shipping Settings
- Pause Selling toggle
- Offers - navigates to the `/offers` screen (row with chevron, not a toggle; the on/off switch already lives on that screen)

### 4. Support
- Help Centre expandable group with:
  - Contact Support
  - FAQ
  - Suggestion Box
  - Terms & Conditions
  - Privacy Policy
  - App Walkthrough

### 5. Logout
- Logout row at the bottom, keeping the existing confirm dialog.
- Guest users see "Log In / Sign Up" instead.

## Technical approach
- Refactor `src/pages/Settings.tsx` to build five explicit item arrays (`generalItems`, `buyerItems`, `sellerItems`, `supportItems`, `logoutItems`) and render them through one shared row renderer instead of the current duplicated Account/Support branches.
- Move the Admin Dashboard row (with `adminBadgeTotal`) from Support to General.
- Replace the Offers toggle with a navigation row to `/offers`; drop the now-unused `handleToggleOffers` from Settings (the toggle stays on the Offers screen).
- Render `PaymentMethodsSection` inside the Seller group, above Shipping Settings and Pause Selling.
- Keep the existing card UI (`rounded-2xl`, `card-shadow`, `bg-card`, section headings, switch styling) unchanged.
- Preserve guest-mode behaviour: auth-required rows call `promptGuest`; guests keep the Log In / Sign Up row and the guest Payment Details placeholder becomes the guest Seller row.
- Keep `BottomNav`, the logout `AlertDialog`, the Filter Preferences and Shipping Settings sheets, and the post-onboarding status modal working as-is.


## Out of scope
- No backend or edge-function changes.
- No new routes.
- No changes to `EditProfile.tsx` unless requested; `SavedCardsSection` will simply be reused inside the new Buyer sheet.
