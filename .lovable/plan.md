I checked the connected Stripe account I can access: it is the live Flea account. Stripe’s own docs say native iOS Apple Pay is configured under **Stripe Dashboard → Settings → Payment methods → Apple Pay → iOS Certificate Settings** (`/settings/ios_certificates`). That section is different from the general “Apple Pay enabled” payment-method toggle.

Important correction: with Stripe, you do not manually handle the Apple Pay payment-processing certificate yourself, but Stripe still has to have the iOS Apple Pay application/merchant registration in that iOS certificates area. If it worked before, it likely existed before, or the working build/request path matched the configured merchant/app setup.

## Plan

1. **Stop asking you to re-check device/card/state.**
   - Treat the device, Wallet card, and “it worked previously” as confirmed.
   - Do not change status bar, footer, splash, safe areas, or native shell styling.

2. **Inspect Stripe-side iOS Apple Pay state using available Stripe access.**
   - Confirm whether the connected Flea Stripe account has an iOS Apple Pay application/certificate entry for `merchant.com.finditonflea.app`.
   - If Stripe API tooling cannot expose that dashboard-only object, I’ll say that plainly and give the exact dashboard path, not guess.

3. **Compare the actual native Apple Pay request shape against the working build.**
   - Inspect current `Checkout.tsx` native payment code.
   - Compare only the Apple Pay/PaymentSheet request parameters against commit `a30ec32d`: merchant identifier, country, currency, amount formatting, labels, Connect fields, SDK init order, and supported networks.
   - Do not claim “restored” unless the diff proves it.

4. **Choose the fix based on proof, not another blind swap.**
   - If Stripe iOS application registration is missing: no code change; the fix is registering `merchant.com.finditonflea.app` in Stripe’s iOS Certificate Settings.
   - If Stripe registration exists: update only the checkout Apple Pay request code to match the proven-good request shape while keeping current business logic: FREEFLEA, 4% + $0.70 buyer fee, bundle shipping, seller routing, and negative-balance checks.

5. **Add a clear runtime diagnostic before Apple Pay opens.**
   - Log the exact merchant ID, country, currency, total amount, native platform, and Stripe publishable-mode state used for the Apple Pay request.
   - Keep logs internal/admin-only so buyers don’t see technical copy.

6. **Validation.**
   - Confirm no shell/status/footer files changed.
   - Confirm the app no longer silently loops through PaymentSheet/direct Apple Pay guesses without exposing the real request configuration.