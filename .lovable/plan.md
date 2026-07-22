Problem found:
- @sarahhearn2 does have bundle shipping turned on: `discounted`, `20%`.
- The cart fetches bundle settings from `profiles_public`, but that public profile path is currently blocked with `permission denied for function get_profiles_public`.
- Unlike the normal seller-profile lookup, the bundle-shipping lookup silently ignores that failure and returns an empty settings map, so the cart never gets `discounted/free` and `getBundleBreakdownText()` returns nothing.

Plan:
1. Restore public profile access for safe seller fields
   - Add a small backend migration to re-allow app users to read the safe `profiles_public` helper/view used across the marketplace.
   - Keep only public-safe fields exposed; no private payment, email, or verification data.

2. Make bundle shipping resilient in frontend
   - Update `fetchSellerShippingSettings()` to handle `profiles_public` errors instead of silently returning no settings.
   - Add the same fallback pattern used by seller profile lookups so Cart and Checkout still receive bundle settings if the public view glitches.

3. Fix cart messaging behavior
   - Ensure seller cards with 2+ available items show the bundle shipping banner whenever the seller mode is `discounted` or `free`, even if the current item shipping prices are `$0`.
   - Keep the message brand-consistent: `✈️ Bundle discount: 20% off shipping` or `✈️ Free bundle shipping`.

4. Verify the exact reported case
   - Re-check @jcsbh cart with 2 listings from @sarahhearn2.
   - Confirm the bundle banner appears in Cart before Checkout.
   - Confirm Checkout still calculates the same bundled shipping total.