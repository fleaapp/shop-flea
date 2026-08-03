# Reorganise Settings into General / Buyer / Seller / Support / Logout

## Goal
Restructure the Settings page so users can find account, buying, selling, support and logout options in clearly labelled sections.

## Proposed layout

### 1. General
Items that apply to every user regardless of buying or selling.
- Edit Profile
- Notifications toggle
- Marketing emails toggle (currently wired in `Settings.tsx` but not rendered)
- App Walkthrough
- Refresh Passed Listings
- Filter Preferences

### 2. Buyer
Buying-specific settings.
- Payment Details - opens a sheet containing the existing `SavedCardsSection` so buyers can view/remove saved cards (currently only reachable inside Edit Profile).

### 3. Seller
Selling-specific settings and seller-account entry point.
- Seller Dashboard / Become a Seller - the existing `PaymentMethodsSection` row that shows available/pending balance when verified, or onboarding status when not.
- Pause Selling toggle
- Offers toggle
- Shipping Settings (bundle-shipping rules for sellers)

### 4. Support
Help, legal and admin.
- Help Centre expandable group with:
  - Contact Support
  - FAQ
  - Suggestion Box
  - Terms & Conditions
  - Privacy Policy
- Admin Dashboard (admins only, with badge)

### 5. Logout
Standalone section at the bottom.
- Logout button (full-width, destructive styling)
- Guest users see "Log In / Sign Up" instead.

## Technical approach
- Refactor `src/pages/Settings.tsx` to build five explicit item arrays (`generalItems`, `buyerItems`, `sellerItems`, `supportItems`, `logoutItems`) instead of the current `accountItems` / `supportItems` split.
- Keep the existing card UI (`rounded-2xl`, `card-shadow`, `bg-card`, section title styling, switch styling) so the page still matches the rest of the app.
- Add a new local state `paymentDetailsOpen` and a sheet wrapper around `SavedCardsSection` for the Buyer Payment Details row.
- Preserve all guest-mode behaviour: auth-required rows call `promptGuest` when the user is not logged in.
- Preserve the post-onboarding status modal from `PaymentMethodsSection`.
- Keep `BottomNav` and the logout `AlertDialog` unchanged.

## Out of scope
- No backend or edge-function changes.
- No new routes.
- No changes to `EditProfile.tsx` unless requested; `SavedCardsSection` will simply be reused inside the new Buyer sheet.
