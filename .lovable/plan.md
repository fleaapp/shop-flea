# Apple Pay "not available on this device" + post-Cloud slowness

## Apple Pay — real root cause (from the screenshot)

The toast "Apple Pay is not available on this device. Please choose Add new card." is fired **only** from this branch in `src/pages/Checkout.tsx`:

```ts
try { await Stripe.isApplePayAvailable(); }
catch { toast.error('Apple Pay is not available on this device...'); return true; }
```

`@capacitor-community/stripe`'s `isApplePayAvailable` throws for exactly three reasons on a real device:

1. The iOS app target is missing the **Apple Pay capability** with the merchant ID `merchant.com.finditonflea.app` ticked.
2. The merchant identifier isn't registered on Apple Developer (Identifiers → Merchant IDs) or isn't attached to the app's App ID.
3. The device has no cards in Wallet / Apple Pay is region-restricted (unlikely — you're testing on your own iPhone in AU).

Nothing changed on the JS side in the cutover. What changed is you regenerated the `ios/` folder recently (`npx cap add ios` after Cloud move) — that wipes the `App.entitlements` Apple Pay merchant array and the Xcode capability, so `PKPaymentAuthorizationController.canMakePayments(usingNetworks:capabilities:)` returns false and the Stripe plugin throws.

### Fix (code + Xcode)

1. **Bake Apple Pay into `App.entitlements`** so it survives future `npx cap add ios`. Update `ios-native/App.entitlements` to include:
   ```xml
   <key>com.apple.developer.in-app-payments</key>
   <array>
     <string>merchant.com.finditonflea.app</string>
   </array>
   ```
   Update `scripts/setup-ios-native.sh` so it copies this entitlement into `ios/App/App/App.entitlements` on every regen (it already handles push/associated domains — add Apple Pay to the same block).
2. **User step in Xcode** (I'll spell it out):
   - Open `ios/App/App.xcworkspace`.
   - Target **App** → **Signing & Capabilities** → **+ Capability** → **Apple Pay**.
   - Click **+** under Merchant IDs, tick `merchant.com.finditonflea.app`. If it doesn't appear, sign into Apple Developer → **Identifiers** → **Merchant IDs** → create `merchant.com.finditonflea.app`, then back in Xcode click **Refresh**.
   - Also confirm the App ID (`com.finditonflea.app`) has **Apple Pay Payment Processing** enabled and is linked to that merchant ID.
3. **Improve the failure message** so if it fires again the user sees the real cause. Change the catch in `handleNativeWalletConfirm` to surface the underlying error text (e.g. "Apple Pay capability not configured (setup Apple Pay in Xcode)") instead of the generic message. Same for the empty-`publishableKey` case — throw early with a clear message so we never silently do nothing again.
4. **No Stripe/Cloud secret change needed** — `STRIPE_PUBLISHABLE_KEY` is set, the payment-intent function returns it correctly. That was my previous guess and it was wrong; the screenshot rules it out.

## Slowness since Cloud cutover (still valid — same as before)

Verified from the code and DB reads:

- `useHomeFeed` invokes `cleanup-stale-saved-listings` on every 50-row page. Edge logs show constant cold boots on that function → 30–100 ms added to every feed render. The RPC already filters blocked/paused/discarded rows, so this sweep is redundant on the swipe stack.
- The initial paint waits for `fetchSellerProfiles` before setting state. Cards should render as soon as the RPC returns and let profiles fill in.
- No `listings(status, region_id, created_at DESC)` composite index. `get_home_feed`'s candidate CTE and the fallback query both filter/order on exactly that shape.
- `db_health` snapshot is fine (memory 59%, connections 22/60, no OOM/restarts). Not a compute-size issue.

### Fix

1. **`useHomeFeed`**: remove the `getInvalidListingIds` call on the swipe-stack path. Keep it in `Favorites`, `Cart`, and saved-search views where snapshot cleanup matters.
2. **`useHomeFeed`**: set `listings` state as soon as the RPC returns (with `profiles: null`), then merge in seller profiles when `fetchSellerProfiles` resolves. First card paints in one round trip instead of two.
3. **Migration**: `CREATE INDEX listings_active_region_created_idx ON public.listings (region_id, created_at DESC) WHERE status = 'active';`
4. **`App.tsx` / `useHomeFeed`**: preload the first card's image with `fetchpriority=high` (already have `preloadImages`, just bump it to include the top card's primary image).

## Files touched

- `src/pages/Checkout.tsx` — better error surfacing in `handleNativeWalletConfirm`; guard empty publishable key.
- `src/hooks/useHomeFeed.ts` — drop `getInvalidListingIds`; render cards before profiles resolve; preload first image.
- `ios-native/App.entitlements` — add `com.apple.developer.in-app-payments` with the merchant ID.
- `scripts/setup-ios-native.sh` — copy the Apple Pay entitlement into the regenerated `ios/` folder.
- New SQL migration for the active-listings index.

## Verification

- Rebuild in Xcode after adding the Apple Pay capability + merchant ID → tap Apple Pay → the sheet must appear. If it still throws, the new error message names exactly which check failed (capability vs merchant ID vs Wallet).
- Reload the feed as @jcsbh → no `cleanup-stale-saved-listings` request in the Xcode network log; first card image appears in the same frame as the RPC response.
