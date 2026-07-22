## Goal
Replace tiered shipping with a Depop-style **Bundle Shipping** system (No bundle / Discounted / Free), add a Shipping button on the seller profile, and swap the 📦 emoji for ✈️ across the app.

## Bundle shipping rules (confirmed)
A "bundle" = **2+ items from the same seller in one order**. Single-item orders are never affected — they always pay that item's full shipping price.

Per seller group at checkout, given items with per-item `shippingPrice`:
- **none** → sum of each item's shipping (no bundle behaviour).
- **discounted** → if `itemCount === 1`: item's shipping. If `itemCount >= 2`: `sum(items.shippingPrice) × (1 − discount%)`, rounded to 2dp.
- **free** → if `itemCount === 1`: item's shipping. If `itemCount >= 2`: **$0** (free).

## 1. Data model (migration)
Add to `profiles` (keep old tier columns temporarily; stop reading them):
- `bundle_shipping_mode text` — `'none' | 'discounted' | 'free'`, default `'none'`.
- `bundle_shipping_discount_percent int` — nullable, used only when mode = `'discounted'` (10/20/30/40/50).

Re-`CREATE OR REPLACE` `profiles_public` to expose the two new columns. Update `profiles_update_guard` to allow the owner to modify them. Regenerate types.

## 2. Shipping calculator (`src/utils/shippingCalculator.ts`)
Rewrite around the bundle rules above. Expose:
- `fetchSellerBundleSettings(sellerIds)`
- `calculateSellerBundleShipping(items, settings)`
- `calculateTotalShipping(items, settingsMap)` (same signature as today)
- `getBundleBreakdownText(itemCount, settings)` for Cart/Checkout copy.

## 3. Seller-facing Shipping settings
Rebuild `ShippingSettingsSheet` (drawer used from Settings):
- Header: **✈️ Bundle Shipping**
- Radio-style options: No bundle shipping / Discounted shipping for bundles / Free shipping for bundles.
- When Discounted is selected, show a percentage picker (10/20/30/40/50%) with helper copy ("Buyers save X% off total shipping when they buy 2+ items").
- Save writes `bundle_shipping_mode` + `bundle_shipping_discount_percent`, refreshes profile, keeps localStorage fallback for `PGRST204`.

Update `TieredShippingSetupModal` (first-listing setup) to the same three-option UI and header.

Update `CreateListing.tsx` / `EditListing.tsx`: they currently prefill shipping from `shipping_tier_1`; switch to the seller's own per-listing shipping input (bundle logic is applied at checkout, not on the listing). Remove tier prefill.

## 4. Seller Profile — new Shipping button
On `src/pages/Profile.tsx`, directly under the top-right 💸 Sales button (line ~171), add an identical-styled button:
- Same size, border, rounded-xl treatment.
- Icon: ✈️, `aria-label="Shipping"`.
- Opens the same `ShippingSettingsSheet`.
- Guest `Profile` (line 431) mirrors it but taps through to `/auth` like Sales does.

## 5. Cart + Checkout wiring
- `Cart.tsx` bundle label (line ~407): only show when `itemCount >= 2` and mode ≠ `'none'`. Copy: `✈️ Bundle discount: X% off shipping` or `✈️ Free bundle shipping`.
- `Checkout.tsx` uses the new `calculateTotalShipping` (same signature) — verify buyer-facing totals and the amounts sent to `finalize-checkout` reflect the bundle rules.
- `SalesDetailsSheet.tsx` / `OrderDetailsSheet.tsx` / receipts: shipping totals come from stored `orders.shipping_price` per item, so no math change — swap 📦 → ✈️ in copy only.

## 6. Emoji sweep (📦 → ✈️)
Swap in shipping contexts: `SwipeCard`, `ProfileGridCard`, `WishlistCard`, `WishlistGridCard`, `SellerProfile` and `Profile` list cards, `Cart.tsx` bundle label, `Settings.tsx` shipping row, `SalesDetailsSheet`/`OrderDetailsSheet` "Track parcel", `Profile.tsx` + `ListingDetails.tsx` "Mark as shipped" toasts, `ShippingStatusTracker` shipped step, `RealtimeAlerts` `order_shipped`, `useNotifications` shipped/reminder templates, `OnboardingMiniCard`, `Notifications` fallback, `OrderItemThumbnailStack` fallback, `FAQSection` "Shipping" category header. Leave 📦 in admin-only "Listings" contexts (`AdminListings`, `AdminDashboard`, `ReportList`) — those refer to the listings module, not shipping.

## 7. Cleanup / safety
- `AuthContext` profile type: add `bundle_shipping_mode`, `bundle_shipping_discount_percent`; keep old tier fields optional.
- `shippingPrefs.ts` localStorage: extend to `{ mode, discountPercent }`; keep old shape readable for one release.
- Existing orders/receipts unchanged; only new checkouts use bundle math.
- No fee changes (buyer 4% + $0.70).
